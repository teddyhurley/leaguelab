"""Rebuild browser history and historical game fits for all five sports from audited snapshots.
Python standard library only. No network; exact source manifests are in data/history.
"""
import bisect
import collections
import hashlib
import json
import math
from pathlib import Path
from empirical import audit_games, record_rows, design_records, calibration, score_summary
from mlb import build_mlb
from binary import fit, metrics, logistic
from regular import build_regular
from soccer import lookback_rows, fit_three_way, three_way_metrics, three_way_calibration

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'data/history'
read = lambda name: json.loads((DATA / name).read_text())


def record_rate(row, sport):
    if sport == 'nhl':
        assert row['points'] == 2 * row['wins'] + row['overtimeLosses'] + row.get('ties', 0)
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




records = {s: read(s + '-team-seasons.json') for s in ['nba', 'nhl']}
season_games = {'nba': 82, 'nhl': 84, 'mlb': 162, 'nfl': 17, 'soccer': 38}
history, validation, feature_audit = {}, {}, {}
reference = read('rarity-reference.json')
for sport in season_games:
    ref = reference['sports'][sport]
    cohort = ref['teamSeasons']
    season_ends = sorted(set(r['seasonEnd'] for r in cohort))
    assert season_ends == ref['includedSeasonEnds'] and len(season_ends) == reference['seasonsPerLeague']
    entry = {k: ref[k] for k in ['window', 'note', 'publisher', 'url']}
    entry.update({'seasonGames': season_games[sport],
                  'reference': {'asOf': reference['asOf'], 'seasonCount': len(season_ends), 'includedSeasonEnds': season_ends},
                  'sampleSize': len(cohort), 'knots': knots(cohort, sport),
                  'recordUnit': 'points' if sport in ['nhl', 'soccer'] else 'wins',
                  'maxPerGame': 2 if sport == 'nhl' else 3 if sport == 'soccer' else 1})
    entry['maxRecord'] = entry['seasonGames'] * entry['maxPerGame']
    if sport in ['nhl', 'soccer']:
        entry['legacyWinKnots'] = ref['legacyWinKnots']
    outcome_games = read(sport + '-games.json')
    game_counts = audit_games(outcome_games, sport)
    cutoff = 2021 if sport in ['mlb', 'nfl'] else 2022
    if sport in ['nba', 'nhl', 'nfl']:
        improved = build_regular(outcome_games, sport, cohort, knots, rank)
        for field in ['fit', 'validation', 'playoffValidation']:
            entry[field] = improved[field]
        feature_audit[sport] = improved['featureAudit']
        if sport in ['nba', 'nhl']:
            rows = records[sport]
            entry['meanScore'] = sum(r['pointsFor' if sport == 'nba' else 'goalsFor'] for r in rows) / sum(r['games'] for r in rows)
            entry['playoffs'] = read(sport + '-playoff-summary.json')
        else:
            summary = score_summary(outcome_games)
            entry['meanScore'], entry['scoringEvidence'] = summary['meanPerTeam'], summary
    elif sport == 'mlb':
        improved = build_regular(outcome_games, sport, cohort, knots, rank)
        for field in ['fit', 'validation', 'playoffValidation']:
            entry[field] = improved[field]
        feature_audit['mlbLookback'] = improved['featureAudit']
        pregame = build_mlb(outcome_games, cohort)
        feature_audit['mlbRegular'] = pregame['featureAudit']
        # Preserve the earlier pre-playoff feature audit as a separate data check.
        old_features, old_excluded = record_rows(outcome_games, sport)
        feature_audit['mlb'] = {'scope': 'Legacy pre-playoff record audit, not the shipped fit', 'inputGameCounts': game_counts, 'excluded': old_excluded, 'rows': old_features}
        summary = score_summary(outcome_games)
        entry['meanScore'], entry['scoringEvidence'] = summary['meanPerTeam'], summary
        (DATA / 'mlb-model-comparison.json').write_text(json.dumps(pregame['comparison'], indent=2) + '\n')
    else:
        features = lookback_rows(outcome_games)
        train_knots = knots([r for r in cohort if r['seasonEnd'] <= cutoff], sport)
        all_rows = design_records(features, entry['knots'], rank, logit)
        train = design_records([r for r in features if r['season'] <= cutoff], train_knots, rank, logit)
        test = design_records([r for r in features if r['season'] > cutoff], train_knots, rank, logit)
        entry['fit'] = fit_three_way(all_rows)
        individual = [logit(rank(r[side + 'Rate'], entry['knots'])) for r in features for side in ['home', 'away']]
        entry['fit'].update({'recordMetric': 'season-end earned points percentage excluding both head-to-head matches',
                             'games': len(all_rows), 'scope': 'Season-end lookback · win / draw / loss',
                             'window': '2015–16 to 2024–25', 'drawGames': sum(r['outcome'] == .5 for r in features),
                             'featureTiming': 'Other 36 season matches; both meetings removed. Includes hindsight.', 'retrospective': True,
                             'maxAbsStrengthGap': max(abs(r[0]) for r in all_rows),
                             'individualStrengthRange': [min(individual), max(individual)]})
        trained, home = fit_three_way(train), fit_three_way(train, True)
        entry['validation'] = {'recordMetric': entry['fit']['recordMetric'],
            'training': '2015–16 to 2021–22 league matches', 'test': '2022–23 to 2024–25 league matches',
            'trainingGames': len(train), 'trainingFit': trained,
            'model': three_way_metrics(test, trained), 'homeOnly': three_way_metrics(test, home),
            'coinFlip': three_way_metrics(test, {'slope': 0, 'homeLogOdds': 0, 'drawLogWeight': 0}),
            'metric': 'Multiclass Brier (sum over win/draw/loss)',
            'interpretation': 'Retrospective association with season-end information, not forecasting accuracy',
            'calibration': three_way_calibration(test, trained), 'drawGames': sum(r[2] == .5 for r in test),
            'tieScoring': 'Draw is an observed third outcome'}
        summary = score_summary(outcome_games)
        entry['meanScore'], entry['scoringEvidence'] = summary['meanPerTeam'], summary
        feature_audit[sport] = {'scope': 'Retrospective league matches; both head-to-head meetings excluded from strength',
                                 'inputGameCounts': game_counts, 'excluded': {}, 'rows': features}
    if sport in ['nba', 'nhl', 'mlb']:
        audit_key = 'mlbLookback' if sport == 'mlb' else sport
        rows = [r for r in feature_audit[audit_key]['rows'] if r['phase'] == 'regular']
        unequal = [r for r in rows if abs(r['homeRate'] - r['awayRate']) > 1e-10]
        wins = sum((r['homeRate'] > r['awayRate']) == bool(r['outcome']) for r in unequal)
        entry['observedBetterRecord'] = {'wins': wins, 'games': len(unequal), 'rate': wins / len(unequal),
            'equalRecordsExcluded': len(rows) - len(unequal),
            'definition': 'Regular-season outcomes; season rates against other opponents, excluding all head-to-head meetings. Unequal records and decisive games only.'}
    if sport == 'nba':
        # Frozen exploratory release review of the unchanged NBA fit. Keep the
        # broader weak-record finding alongside the primary three-season check.
        review = read('release-model-evaluation.json')
        for source in ['nba-games.json', 'rarity-reference.json']:
            assert hashlib.sha256((DATA / source).read_bytes()).hexdigest() == review['sourceHashes'][source], 'Re-evaluate NBA subgroup evidence after changing ' + source
        release = review['sports']['nba']['candidates']
        entry['additionalEvidence'] = {'scope': 'Five rolling season checks, 2020–21 to 2024–25',
            'bothBottomQuartile': {k: release[v]['subgroups']['bothBottomQuartile'] for k, v in [('model', 'current_rarity'), ('homeOnly', 'home_only')]}}
    entry['validation']['rarityReference'] = {
        'cutoffSeasonEnd': cutoff, 'includedSeasonEnds': [y for y in season_ends if y <= cutoff],
        'teamSeasons': sum(r['seasonEnd'] <= cutoff for r in cohort),
        'note': 'Evaluation rank knots use only reference records at or before the training cutoff; production ranks use all 20 eligible seasons.'}
    validation[sport] = entry['validation']
    if 'playoffValidation' in entry:
        validation[sport + 'Playoffs'] = entry['playoffValidation']
    history[sport] = entry
assert [history[s]['sampleSize'] for s in history] == [599, 612, 600, 638, 400]
(ROOT / 'dist/src/history-data.js').write_text('/** Generated by scripts/history/build.py; all-team regular-season baselines; snapshot 2026-10-07. */\nexport const HISTORY = ' + json.dumps(history, separators=(',', ':')) + ';\n')
(DATA / 'feature-audit.json').write_text(json.dumps(feature_audit, separators=(',', ':')) + '\n')
(DATA / 'validation.json').write_text(json.dumps(validation, indent=2) + '\n')
print(json.dumps({s: {'fit': history[s]['fit'], 'validation': validation[s], 'playoffValidation': history[s].get('playoffValidation')} for s in history}, indent=2))
