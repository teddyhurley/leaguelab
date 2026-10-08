"""Small regularized binary model shared by the historical builders."""
import math


def logistic(x):
    return 1 / (1 + math.exp(-x))


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
    return {'games': n, 'brier': sum((p - r[2]) ** 2 + r[2] * (1 - r[2]) for p, r in zip(ps, rows)) / n,
            'logLoss': -sum(r[2] * math.log(p) + (1-r[2]) * math.log(1-p) for p, r in zip(ps, rows)) / n,
            'meanPredictedHomeWinCredit': sum(ps) / n, 'observedHomeWinCredit': sum(r[2] for r in rows) / n}

