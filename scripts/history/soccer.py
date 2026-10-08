"""Retrospective Premier League strength and three-way outcomes.

Both meetings between the clubs are removed from each season record. The
remaining 36 matches include future results: this is descriptive, not pregame.
"""
import collections
import math


def lookback_rows(games):
    rows = []
    seasons = collections.defaultdict(list)
    for g in games:
        seasons[g['season']].append(g)
    for season, matches in sorted(seasons.items()):
        records = collections.defaultdict(lambda: [0, 0])
        pairs = collections.defaultdict(list)
        for g in matches:
            pair = tuple(sorted([g['homeId'], g['awayId']]))
            pairs[pair].append(g)
            for side, other in [('home', 'away'), ('away', 'home')]:
                score, opponent = g[side + 'Score'], g[other + 'Score']
                r = records[g[side + 'Id']]
                r[0] += 3 if score > opponent else int(score == opponent)
                r[1] += 1
        assert len(matches) == 380 and len(records) == 20
        assert all(r[1] == 38 for r in records.values())
        assert all(len(pair) == 2 for pair in pairs.values())
        for g in sorted(matches, key=lambda x: (x['date'], str(x['gameId']))):
            excluded = pairs[tuple(sorted([g['homeId'], g['awayId']]))]
            row = {'gameId': str(g['gameId']), 'season': season, 'date': g['date'][:10],
                   'featureTiming': 'Season end, excluding both head-to-head matches',
                   'excludedGameIds': sorted(str(x['gameId']) for x in excluded),
                   'venue': 0 if g.get('neutral', False) else 1,
                   'outcome': 1 if g['homeScore'] > g['awayScore'] else 0 if g['homeScore'] < g['awayScore'] else .5}
            for side in ['home', 'away']:
                team = g[side + 'Id']
                points, played = records[team]
                for x in excluded:
                    own = 'home' if x['homeId'] == team else 'away'
                    other = 'away' if own == 'home' else 'home'
                    points -= 3 if x[own + 'Score'] > x[other + 'Score'] else int(x[own + 'Score'] == x[other + 'Score'])
                    played -= 1
                assert played == 36
                row[side + 'Record'] = [points, played]
                row[side + 'Rate'] = points / (3 * played)
            rows.append(row)
    return rows


def probabilities(model, x, venue):
    eta = model['slope'] * x + model['homeLogOdds'] * venue
    logits = [eta / 2, model['drawLogWeight'], -eta / 2]  # win, draw, loss
    peak = max(logits)
    masses = [math.exp(v - peak) for v in logits]
    return [v / sum(masses) for v in masses]


def solve(matrix, vector):
    a = [row[:] + [v] for row, v in zip(matrix, vector)]
    for i in range(len(a)):
        pivot = max(range(i, len(a)), key=lambda j: abs(a[j][i]))
        a[i], a[pivot] = a[pivot], a[i]
        divisor = a[i][i]
        assert abs(divisor) > 1e-12
        a[i] = [v / divisor for v in a[i]]
        for j in range(len(a)):
            if j != i:
                factor = a[j][i]
                a[j] = [v - factor * w for v, w in zip(a[j], a[i])]
    return [row[-1] for row in a]


def fit_three_way(rows, home_only=False):
    # Davidson symmetric win/draw/loss model. Fixed ridge, no holdout tuning.
    theta, penalty = [0., 0., 0.], 4.
    for _ in range(50):
        gradient = [penalty * theta[0], penalty * theta[1], 0.]
        hessian = [[penalty, 0., 0.], [0., penalty, 0.], [0., 0., 0.]]
        model = dict(zip(['slope', 'homeLogOdds', 'drawLogWeight'], theta))
        for x, z, y in rows:
            x = 0 if home_only else x
            fs = [[x / 2, z / 2, 0.], [0., 0., 1.], [-x / 2, -z / 2, 0.]]
            ps = probabilities(model, x, z)
            target = 0 if y == 1 else 2 if y == 0 else 1
            means = [sum(p * f[i] for p, f in zip(ps, fs)) for i in range(3)]
            for i in range(3):
                gradient[i] += means[i] - fs[target][i]
                for j in range(3):
                    hessian[i][j] += sum(p * f[i] * f[j] for p, f in zip(ps, fs)) - means[i] * means[j]
        step = solve(hessian, gradient)
        theta = [theta[i] - step[i] for i in range(3)]
        theta[0] = max(0., theta[0])
        if max(abs(s) for s in step) < 1e-10:
            break
    return {'family': 'davidson', 'slope': theta[0], 'homeLogOdds': theta[1],
            'drawLogWeight': theta[2], 'ridgePenalty': penalty,
            'regularization': 'Ridge on strength and home; unpenalized draw intercept'}


def three_way_metrics(rows, model):
    predictions = [probabilities(model, x, z) for x, z, _ in rows]
    targets = [0 if y == 1 else 2 if y == 0 else 1 for _, _, y in rows]
    n = len(rows)
    return {'games': n,
            'brier': sum(sum((p - int(i == target)) ** 2 for i, p in enumerate(ps)) for ps, target in zip(predictions, targets)) / n,
            'logLoss': -sum(math.log(ps[target]) for ps, target in zip(predictions, targets)) / n,
            'meanPredicted': [sum(ps[i] for ps in predictions) / n for i in range(3)],
            'observed': [targets.count(i) / n for i in range(3)]}


def three_way_calibration(rows, model):
    result = {}
    for category, name in enumerate(['win', 'draw', 'loss']):
        bins = [[] for _ in range(5)]
        for x, z, y in rows:
            p = probabilities(model, x, z)[category]
            target = 0 if y == 1 else 2 if y == 0 else 1
            bins[min(4, int(p * 5))].append((p, int(target == category)))
        result[name] = [{'from': i / 5, 'to': (i + 1) / 5, 'games': len(b),
                         'predicted': sum(p for p, _ in b) / len(b),
                         'observed': sum(y for _, y in b) / len(b)} for i, b in enumerate(bins) if b]
    return result
