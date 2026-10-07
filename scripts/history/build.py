"""Rebuild browser history and exploratory NBA/NHL fits from audited snapshots.
Python standard library only. No network; exact source manifests are in data/history.
"""
import bisect
import collections
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'data/history'
read = lambda name: json.loads((DATA / name).read_text())


def record_rate(row, sport):
    if sport == 'nhl':
        assert row['points'] == 2 * row['wins'] + row['overtimeLosses']
        return row['points'] / (2 * row['games'])
    if sport == 'soccer':
        # Earned points, before administrative deductions.
        return (3 * row['wins'] + row['draws']) / (3 * row['games'])
    return row['wins'] / row['games']


def knots(rows, sport):
    counts = collections.Counter(round(record_rate(r, sport), 12) for r in rows)
    n, before, result = len(rows), 0, []
    for rate, count in sorted(counts.items()):
        result.append([rate, (before + count / 2 + .5) / (n + 1), count])
        before += count
    return result


def rank(rate, points):
    i = bisect.bisect_left([x[0] for x in points], rate)
    if i == 0:
        return points[0][1]
    if i == len(points):
        return points[-1][1]
    lo, hi = points[i - 1], points[i]
    return lo[1] + (hi[1] - lo[1]) * (rate - lo[0]) / (hi[0] - lo[0])


def logit(p):
    return math.log(p / (1 - p))


def logistic(x):
    return 1 / (1 + math.exp(-x))


def design(games, points, sport, seasons):
    # Pre-postseason records; use actual season lengths, including shortened years.
    # All 2020 bubble games are neutral, overriding unreliable upstream flags.
    def rate(game, side):
        if sport == 'nba':
            return game[side + 'Wins82'] / 82
        return record_rate(seasons[(game['seasonEnd'], str(game[side + 'Id']))], sport)
    return [(logit(rank(rate(g, 'home'), points)) - logit(rank(rate(g, 'away'), points)),
             0 if g['seasonEnd'] == 2020 or g['neutral'] else 1,
             int(str(g['winnerId']) == str(g['homeId']))) for g in games]


def fit(rows, home_only=False):
    # Fixed L2 penalty, chosen before validation; no tuning on test seasons.
    b, h, penalty = 0., 0., 4.
    for _ in range(60):
        gb, gh, hbb, hhh, hbh = penalty * b, penalty * h, penalty, penalty, 0.
        for x, z, y in rows:
            x = 0 if home_only else x
            p = logistic(b * x + h * z)
            gb += (p - y) * x
            gh += (p - y) * z
            v = p * (1 - p)
            hbb += v * x * x
            hhh += v * z * z
            hbh += v * x * z
        det = hbb * hhh - hbh * hbh
        db, dh = (gb * hhh - gh * hbh) / det, (gh * hbb - gb * hbh) / det
        b, h = max(0, b - db), h - dh
        if max(abs(db), abs(dh)) < 1e-10:
            break
    return {'slope': b, 'homeLogOdds': h, 'ridgePenalty': penalty}


def metrics(rows, model):
    ps = [logistic(model['slope'] * x + model['homeLogOdds'] * z) for x, z, _ in rows]
    n = len(rows)
    return {'games': n, 'brier': sum((p - r[2]) ** 2 for p, r in zip(ps, rows)) / n,
            'logLoss': -sum(r[2] * math.log(p) + (1-r[2]) * math.log(1-p) for p, r in zip(ps, rows)) / n,
            'meanPredictedHomeWin': sum(ps) / n, 'observedHomeWin': sum(r[2] for r in rows) / n}


records = {s: read(s + '-team-seasons.json') for s in ['nba', 'nhl']}
other = read('other-team-seasons.json')
for sport in ['mlb', 'nfl', 'soccer']:
    records[sport] = [r for r in other['teamSeasons'] if r['sport'] == sport and r['included']]
meta = {
    'nba': (82, '2015–16 to 2024–25', '240 full 82-game team-seasons; 2019–20 and 2020–21 excluded.', 'SportsDataverse / ESPN', 'https://github.com/sportsdataverse/hoopR-nba-raw'),
    'nhl': (84, '2015–16 to 2024–25', '250 full 82-game team-seasons; 2026–27 display uses 84-game pace.', 'Official NHL statistics', 'https://api.nhle.com/stats/rest/en/team/summary?isAggregate=false&isGame=false&start=0&limit=100&cayenneExp=seasonId%3D20242025%20and%20gameTypeId%3D2'),
    'mlb': (162, '2015 to 2024', '270 team-seasons; shortened 2020 excluded; actual 161–163 games normalized.', 'Official MLB StatsAPI', 'https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=2024&standingsTypes=regularSeason'),
    'nfl': (17, '2015 to 2024', '318 team-seasons; 16/17 games normalized; incomplete BUF/CIN 2022 excluded.', 'nflverse game records', 'https://github.com/nflverse/nfldata/blob/master/data/games.csv'),
    'soccer': (38, '2015–16 to 2024–25', '200 Premier League team-seasons, each 38 matches; earned points before deductions.', 'OpenFootball (CC0)', 'https://github.com/openfootball/football.json')
}
history, validation = {}, {}
for sport, rows in records.items():
    cohort = [r for r in rows if r['games'] == 82] if sport in ['nba', 'nhl'] else rows
    games, window, note, publisher, url = meta[sport]
    entry = {'seasonGames': games, 'window': window, 'note': note, 'publisher': publisher, 'url': url,
             'sampleSize': len(cohort), 'knots': knots(cohort, sport),
             'recordUnit': 'points' if sport in ['nhl', 'soccer'] else 'wins',
             'maxPerGame': 2 if sport == 'nhl' else 3 if sport == 'soccer' else 1}
    entry['maxRecord'] = games * entry['maxPerGame']
    if sport in ['nhl', 'soccer']:
        # Retain the old scale only to translate saved win-based configurations.
        entry['legacyWinKnots'] = knots(cohort, 'wins')
    if sport in ['nba', 'nhl']:
        entry['meanScore'] = sum(r['pointsFor' if sport == 'nba' else 'goalsFor'] for r in rows) / sum(r['games'] for r in rows)
        playoff = read(sport + '-playoff-games.json')
        entry['playoffs'] = read(sport + '-playoff-summary.json')
        seasons = {(r['seasonEnd'], str(r['teamId'])): r for r in rows}
        entry['fit'] = fit(design(playoff, entry['knots'], sport, seasons))
        entry['fit']['recordMetric'] = 'points percentage' if sport == 'nhl' else 'win percentage'
        entry['fit']['games'] = len(playoff)
        train_knots = knots([r for r in cohort if r['seasonEnd'] <= 2022], sport)
        train = design([g for g in playoff if g['seasonEnd'] <= 2022], train_knots, sport, seasons)
        test = design([g for g in playoff if g['seasonEnd'] >= 2023], train_knots, sport, seasons)
        trained, home = fit(train), fit(train, True)
        entry['validation'] = {'recordMetric': entry['fit']['recordMetric'], 'training': '2016–2022 postseasons', 'test': '2023–2025 postseasons',
                               'trainingGames': len(train), 'trainingFit': trained,
                               'model': metrics(test, trained), 'homeOnly': metrics(test, home),
                               'coinFlip': metrics(test, {'slope': 0, 'homeLogOdds': 0})}
        validation[sport] = entry['validation']
    history[sport] = entry
assert [history[s]['sampleSize'] for s in history] == [240, 250, 270, 318, 200]
(ROOT / 'dist/src/history-data.js').write_text('/** Generated by scripts/history/build.py; audited snapshot 2026-10-05. */\nexport const HISTORY = ' + json.dumps(history, separators=(',', ':')) + ';\n')
(DATA / 'validation.json').write_text(json.dumps(validation, indent=2) + '\n')
print(json.dumps({s: {'fit': history[s]['fit'], 'validation': validation[s]} for s in validation}, indent=2))
