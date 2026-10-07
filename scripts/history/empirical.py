"""Leakage-safe features for MLB/NFL playoffs and Premier League matches.
Only bundled clean game snapshots are read; no network or third-party packages.
"""
import collections
import itertools
import math


def audit_games(games, sport):
    ids = [str(g['gameId']) for g in games]
    assert len(ids) == len(set(ids)), 'Duplicate game IDs: ' + sport
    assert games and all(g['sport'] == sport for g in games)
    for g in games:
        assert g['homeId'] != g['awayId']
        assert g['phase'] in ['regular', 'playoff']
        assert len(g['date']) >= 10
        for side in ['home', 'away']:
            assert isinstance(g[side + 'Score'], int) and g[side + 'Score'] >= 0
    return dict(sorted(collections.Counter((str(g['season']) + ' ' + g['phase']) for g in games).items()))


def record_rows(games, sport):
    """Store only records available before the predicted game.

    Playoffs use that season's completed regular schedule, never playoff wins.
    EPL uses a same-date snapshot of previous earned points, after >=10 matches
    for BOTH clubs. No current/future match result enters either record.
    """
    rows = []
    excluded = collections.Counter()
    for season, grouped in itertools.groupby(sorted(games, key=lambda g: (g['season'], g['date'], str(g['gameId']))), key=lambda g: g['season']):
        season_games = list(grouped)
        regular = [g for g in season_games if g['phase'] == 'regular']
        records = collections.defaultdict(lambda: [0, 0])  # earned units, games
        def add(g):
            hs, away = g['homeScore'], g['awayScore']
            for team, won in [(g['homeId'], hs > away), (g['awayId'], away > hs)]:
                records[team][0] += (3 if won else int(hs == away)) if sport == 'soccer' else int(won)
                records[team][1] += 1
        def capture(g, last_record_date):
            home, away = records[g['homeId']], records[g['awayId']]
            assert home[1] and away[1]
            assert last_record_date < g['date'][:10]
            return {'gameId': str(g['gameId']), 'season': season, 'date': g['date'][:10],
                    'recordThrough': last_record_date, 'homeRecord': home[:], 'awayRecord': away[:],
                    'homeRate': home[0] / ((3 if sport == 'soccer' else 1) * home[1]),
                    'awayRate': away[0] / ((3 if sport == 'soccer' else 1) * away[1]),
                    'venue': 0 if g.get('neutral', False) else 1,
                    'outcome': 1 if g['homeScore'] > g['awayScore'] else 0 if g['homeScore'] < g['awayScore'] else .5}
        if sport != 'soccer':
            for g in regular:
                add(g)
            through = max(g['date'][:10] for g in regular)
            for g in season_games:
                if g['phase'] == 'playoff':
                    rows.append(capture(g, through))
        else:
            last_date = ''
            for date, on_date in itertools.groupby(regular, key=lambda g: g['date'][:10]):
                batch = list(on_date)
                for g in batch:
                    if min(records[g['homeId']][1], records[g['awayId']][1]) < 10:
                        excluded['fewerThanTenPriorMatches'] += 1
                    else:
                        rows.append(capture(g, last_date))
                for g in batch:
                    add(g)
                last_date = date
            assert len(regular) == 380 and len(records) == 20
            assert all(r[1] == 38 for r in records.values())
    return rows, dict(excluded)


def design_records(rows, points, rank, logit):
    return [(logit(rank(r['homeRate'], points)) - logit(rank(r['awayRate'], points)), r['venue'], r['outcome']) for r in rows]


def calibration(rows, model, logistic):
    bins = [[] for _ in range(5)]
    for x, venue, outcome in rows:
        p = logistic(model['slope'] * x + model['homeLogOdds'] * venue)
        bins[min(4, int(p * 5))].append((p, outcome))
    return [{'from': i / 5, 'to': (i + 1) / 5, 'games': len(b),
             'predicted': sum(p for p, _ in b) / len(b),
             'observedWinCredit': sum(y for _, y in b) / len(b)} for i, b in enumerate(bins) if b]


def score_summary(games):
    regular = [g for g in games if g['phase'] == 'regular']
    return {'games': len(regular), 'totalScore': sum(g['homeScore'] + g['awayScore'] for g in regular),
            'meanPerTeam': sum(g['homeScore'] + g['awayScore'] for g in regular) / (2 * len(regular)),
            'scope': 'Completed regular-season final scores, including extra time when played'}
