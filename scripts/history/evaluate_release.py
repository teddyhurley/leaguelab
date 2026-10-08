"""Release model comparison, using bundled data and only the standard library.

Expanding-window, whole-season evaluations; no random game split. This is
exploratory because these historical seasons have already been inspected.
Does not change shipped coefficients or the app. Run from any directory.
"""
import bisect
import collections
import hashlib
import itertools
import json
import math
from pathlib import Path

from binary import fit, logistic
from mlb import pregame_rows, win_strength
from soccer import fit_three_way, probabilities

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'data/history'
COVID = {'nba': {2020, 2021}, 'nhl': {2020, 2021}, 'mlb': {2020}, 'nfl': {2020}, 'soccer': {2020, 2021}}
REFERENCE_GAMES = {'nba': 82, 'nhl': 84, 'mlb': 162, 'nfl': 17, 'soccer': 38}
MAX_CREDIT = {'nba': 1, 'nhl': 2, 'mlb': 1, 'nfl': 1, 'soccer': 3}


def logit(p):
    p = max(1e-10, min(1 - 1e-10, p))
    return math.log(p / (1 - p))


def record_rate(row, sport):
    if sport == 'nhl': return row['points'] / (2 * row['games'])
    if sport == 'soccer': return (3 * row['wins'] + row['draws']) / (3 * row['games'])
    return row['wins'] / row['games']


def rank_knots(reference, sport, cutoff):
    included = [r for r in reference if r['seasonEnd'] <= cutoff]
    assert included
    counts = collections.Counter(round(record_rate(r, sport), 12) for r in included)
    total, before, points = len(included), 0, []
    for value, count in sorted(counts.items()):
        points.append((value, (before + count / 2 + .5) / (total + 1)))
        before += count
    return points


def rank(rate, points):
    i = bisect.bisect_left([p[0] for p in points], rate)
    if i == 0: return points[0][1]
    if i == len(points): return points[-1][1]
    lo, hi = points[i - 1], points[i]
    return lo[1] + (hi[1] - lo[1]) * (rate - lo[0]) / (hi[0] - lo[0])


def features(rows, sport, kind, knots, mean_runs=0):
    def strength(row, side):
        units, games = row[side + 'Record']
        rate = row[side + 'Rate']
        if kind in ('current_rarity', 'playoff_rarity'):
            return logit(rank(rate, knots))
        if kind == 'record_logit':
            # Fixed half-credit smoothing prevents logit(0) and logit(1).
            return logit((units + .5) / (MAX_CREDIT[sport] * games + 1))
        if kind == 'rate_gap': return 4 * rate
        if kind == 'current_wins': return win_strength(units, games)
        if kind == 'pregame_rarity':
            return logit(rank((units + 10) / (games + 20), knots))
        if kind == 'runs_benchmark':
            scored, conceded = row[side + 'Runs']
            return 1.83 * math.log((scored + 20 * mean_runs) / (conceded + 20 * mean_runs))
        if kind in ('home_only', 'chance'): return 0
        raise ValueError(kind)
    return [(strength(r, 'home') - strength(r, 'away'), r['venue'], r['outcome']) for r in rows]


def mlb_lookbacks(games):
    """Alternative completed-season question, kept separate from pregame results."""
    records, pairs, grouped = collections.defaultdict(lambda: [0, 0]), collections.defaultdict(list), []
    for g in games:
        if g['phase'] != 'regular': continue
        pair = (g['season'], tuple(sorted([g['homeId'], g['awayId']])))
        pairs[pair].append(g)
        for side, other in [('home', 'away'), ('away', 'home')]:
            r = records[(g['season'], g[side + 'Id'])]
            r[0] += int(g[side + 'Score'] > g[other + 'Score']); r[1] += 1
    for g in games:
        if g['homeScore'] == g['awayScore']: continue
        removed = pairs[(g['season'], tuple(sorted([g['homeId'], g['awayId']])))]
        row = {k: g[k] for k in ['gameId', 'season', 'phase', 'date', 'homeId', 'awayId']}
        row.update({'venue': 0 if g.get('neutral') else 1, 'outcome': int(g['homeScore'] > g['awayScore']),
                    'excludedGameIds': sorted(x['gameId'] for x in removed)})
        for side in ['home', 'away']:
            team = g[side + 'Id']; wins, played = records[(g['season'], team)]
            for x in removed:
                own = 'home' if x['homeId'] == team else 'away'; other = 'away' if own == 'home' else 'home'
                wins -= int(x[own + 'Score'] > x[other + 'Score']); played -= 1
            assert played > 0
            row[side + 'Record'] = [wins, played]; row[side + 'Rate'] = wins / played
        grouped.append(row)
    return grouped


def forecast(rows, model, sport):
    if sport == 'soccer': return [probabilities(model, x, z) for x, z, _ in rows]
    return [[logistic(model['slope'] * x + model['homeLogOdds'] * z)] for x, z, _ in rows]


def loss(p, y):
    if len(p) == 1:
        return (p[0] - y) ** 2, -(y * math.log(max(1e-12, p[0])) + (1-y) * math.log(max(1e-12, 1-p[0])))
    target = 0 if y == 1 else 2 if y == 0 else 1
    return sum((v - int(i == target)) ** 2 for i, v in enumerate(p)), -math.log(max(1e-12, p[target]))


def summary(predictions):
    if not predictions: return None
    scores = [loss(r['p'], r['y']) for r in predictions]; n = len(scores)
    seasons = sorted(set(r['season'] for r in predictions))
    per_season = {}
    for year in seasons:
        subset = [r for r in predictions if r['season'] == year]
        values = [loss(r['p'], r['y']) for r in subset]
        per_season[str(year)] = {'games': len(values), 'brier': sum(v[0] for v in values) / len(values), 'logLoss': sum(v[1] for v in values) / len(values)}
    calibration = []
    for category in range(len(predictions[0]['p'])):
        bins = []
        for i in range(5):
            subset = [r for r in predictions if min(4, int(5 * r['p'][category])) == i]
            if not subset: continue
            def observed(r):
                if len(r['p']) == 1: return r['y']
                return int(category == (0 if r['y'] == 1 else 2 if r['y'] == 0 else 1))
            bins.append({'from': i/5, 'to': (i+1)/5, 'games': len(subset),
                         'predicted': sum(r['p'][category] for r in subset)/len(subset),
                         'observed': sum(observed(r) for r in subset)/len(subset)})
        calibration.append(bins)
    return {'games': n, 'brier': sum(v[0] for v in scores)/n, 'logLoss': sum(v[1] for v in scores)/n,
            'equalSeasonBrier': sum(v['brier'] for v in per_season.values())/len(seasons),
            'worstSeasonBrier': max(v['brier'] for v in per_season.values()),
            'perSeason': per_season, 'calibration': calibration}


def paired_comparison(candidate, incumbent):
    assert [(r['season'], r['id']) for r in candidate] == [(r['season'], r['id']) for r in incumbent]
    years = sorted(set(r['season'] for r in candidate))
    grouped = {year: [] for year in years}
    for a, b in zip(candidate, incumbent): grouped[a['season']].append(loss(a['p'], a['y'])[0] - loss(b['p'], b['y'])[0])
    deltas = [sum(grouped[y])/len(grouped[y]) for y in years]
    # Exact empirical bootstrap of whole-season mean deltas, not independent games.
    boot = sorted(sum(values)/len(values) for values in itertools.product(deltas, repeat=len(deltas)))
    return {'games': len(candidate), 'equalSeasonBrierDelta': sum(deltas)/len(deltas),
            'seasonsBetter': sum(d < 0 for d in deltas), 'seasons': len(years),
            'seasonDeltas': dict(zip(map(str, years), deltas)),
            'seasonBootstrap95': [boot[int(.025*(len(boot)-1))], boot[int(.975*(len(boot)-1))]],
            'uncertaintyNote': 'Paired empirical season-cluster bootstrap, only %d seasons; descriptive, not a formal confirmatory test. Ignores between-season dependence and model-selection multiplicity.' % len(years)}


def rolling_splits(rows, excluded_years=()):
    years = sorted(set(r['season'] for r in rows))
    assert len(years) == 10
    for test_year in years[5:]:
        if test_year in excluded_years: continue
        train = [r for r in rows if r['season'] < test_year and r['season'] not in excluded_years]
        test = [r for r in rows if r['season'] == test_year]
        assert max(r['season'] for r in train) < test_year
        yield test_year, train, test


def evaluate(sport, rows, reference, games, question='shipped', exclude_covid=False):
    incumbent = 'current_wins' if sport == 'mlb' and question == 'shipped' else 'current_rarity'
    candidates = [incumbent, 'record_logit', 'rate_gap', 'home_only', 'chance']
    if sport == 'mlb' and question == 'shipped': candidates += ['pregame_rarity', 'runs_benchmark']
    if sport in ['nba', 'nhl', 'nfl']: candidates += ['playoff_rarity']
    excluded = COVID[sport] if exclude_covid else set()
    regular = [r for r in rows if r.get('phase', 'regular') == 'regular']
    postseason = [r for r in rows if r.get('phase') == 'playoff']
    predictions = {kind: [] for kind in candidates}; playoffs = {kind: [] for kind in candidates}; folds = []
    for year, train, test in rolling_splits(regular, excluded):
        # Fixed reference cohort, with strict cutoff; era-matching is not claimed.
        knots = rank_knots(reference, sport, year-1)
        earlier_playoffs = [r for r in postseason if r['season'] < year and r['season'] not in excluded]
        later_playoffs = [r for r in postseason if r['season'] == year]
        earlier_games = [g for g in games if g['phase'] == 'regular' and g['season'] < year and g['season'] not in excluded]
        mean_runs = sum(g['homeScore']+g['awayScore'] for g in earlier_games)/(2*len(earlier_games))
        fold = {'testSeason': year, 'trainingSeasons': sorted(set(r['season'] for r in train)),
                'trainingGames': len(train), 'testGames': len(test), 'rankCutoff': year-1, 'fits': {}}
        for kind in candidates:
            training = earlier_playoffs if kind == 'playoff_rarity' else train
            x = features(training, sport, kind, knots, mean_runs)
            if kind == 'chance':
                model = {'slope': 0, 'homeLogOdds': 0, 'drawLogWeight': 0}
            else:
                model = (fit_three_way if sport == 'soccer' else fit)(x, kind == 'home_only')
            fold['fits'][kind] = {'games': len(training), **model}
            for target, destination in [(test, predictions[kind]), (later_playoffs, playoffs[kind])]:
                ps = forecast(features(target, sport, kind, knots, mean_runs), model, sport)
                for r, p in zip(target, ps):
                    low = all(rank(r[side+'Rate'], knots) <= .25 for side in ['home','away'])
                    high = all(rank(r[side+'Rate'], knots) >= .75 for side in ['home','away'])
                    destination.append({'id': r['gameId'], 'season': year, 'p': p, 'y': r['outcome'],
                                        'bothBottomQuartile': low, 'bothTopQuartile': high,
                                        'bothMissed': 'homeReachedPlayoffs' in r and not r['homeReachedPlayoffs'] and not r['awayReachedPlayoffs'],
                                        'bothReached': bool(r.get('homeReachedPlayoffs') and r.get('awayReachedPlayoffs'))})
        folds.append(fold)
    result = {'sport': sport, 'question': question, 'retrospective': sport != 'mlb' or question != 'shipped',
              'incumbent': incumbent, 'excludeCovid': exclude_covid, 'folds': folds, 'candidates': {}}
    for kind in candidates:
        pred = predictions[kind]
        result['candidates'][kind] = {'regular': summary(pred), 'playoff': summary(playoffs[kind]),
            'vsIncumbent': paired_comparison(pred, predictions[incumbent]),
            'vsHome': paired_comparison(pred, predictions['home_only']),
            'subgroups': {name: summary([r for r in pred if r[name]]) for name in ['bothBottomQuartile','bothTopQuartile','bothMissed','bothReached']}}
    return result


def main():
    audit = json.loads((DATA/'feature-audit.json').read_text())
    refs = json.loads((DATA/'rarity-reference.json').read_text())['sports']
    report = {'schemaVersion': 1, 'evaluatedAppVersion': '7.0.0',
              'protocol': {'splits': 'First five outcome seasons train; evaluate each of the final five with expanding earlier-season training. No within-season train/test split.',
                'primaryMetric': 'Equal-season mean Brier; also report game-weighted Brier, log loss, each year, calibration, playoffs and record/playoff subgroups.',
                'promotionRule': 'For the same feature timing and available inputs: improvement >=0.001 equal-season Brier, lower log loss, wins in >=4/5 seasons, and paired season-bootstrap upper bound below zero. This is a conservative engineering rule, not statistical proof. Subgroup and COVID sensitivity can veto promotion.',
                'candidatesFixedBeforeRun': True, 'ridge': 4,
                'recordLogit': 'logit((earned credit + 0.5)/(maximum possible credit + 1))',
                'rateGap': '4 * (home record percentage - away record percentage), fitted coefficient and home term',
                'limitations': ['Previously examined historical periods; no untouched confirmation.', 'Only five evaluation seasons; season-bootstrap intervals are descriptive.', 'Rarity reference is current selected cohort restricted by cutoff, not a reconstructable contemporaneous rolling 20-season archive.', 'Pregame MLB and lookback models answer different questions; do not rank their losses together.', 'MLB retains the source pipeline assumption that designated home is home except documented neutral games; missing neutral flags are not independently resolved here.', 'Cross-sport translation, counterfactual scoring and series independence are not validated by these tests.']},
              'sourceHashes': {}, 'sports': {}, 'covidSensitivity': {}}
    for name in ['feature-audit.json','rarity-reference.json'] + [s+'-games.json' for s in MAX_CREDIT]:
        report['sourceHashes'][name] = hashlib.sha256((DATA/name).read_bytes()).hexdigest()
    for sport in MAX_CREDIT:
        games = json.loads((DATA/(sport+'-games.json')).read_text())
        rows = pregame_rows(games)[0] if sport == 'mlb' else audit[sport]['rows']
        reference = refs[sport]['teamSeasons']
        report['sports'][sport] = evaluate(sport, rows, reference, games)
        report['covidSensitivity'][sport] = evaluate(sport, rows, reference, games, exclude_covid=True)
        if sport == 'mlb':
            retrospective = mlb_lookbacks(games)
            report['mlbCompletedSeasonQuestion'] = evaluate(sport, retrospective, reference, games, question='completed_season')
            report['mlbCompletedSeasonCovidSensitivity'] = evaluate(sport, retrospective, reference, games, question='completed_season', exclude_covid=True)
        print(sport+' completed', flush=True)
    destination = DATA/'release-model-evaluation.json'
    destination.write_text(json.dumps(report, indent=2)+'\n')
    print(str(destination), flush=True)


if __name__ == '__main__': main()
