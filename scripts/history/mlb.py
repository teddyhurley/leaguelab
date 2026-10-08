"""Reproducible MLB record model and run-based challenger, standard library only.

These pregame candidates are retained for comparison, not deployed in v8.
The run-based challenger is evaluated with actual historical runs; those inputs
are NOT invented for a hypothetical team. Neither model knows starting pitchers.
No source files are read or written when this module is imported.
"""
import bisect
import collections
import itertools
import math

MIN_PRIOR_GAMES = 20
PRIOR_GAMES = 20
REFERENCE_GAMES = 162
PYTHAGOREAN_EXPONENT = 1.83
TRAIN_END = 2021
RIDGE = 4.0


def logistic(value):
    return 1 / (1 + math.exp(-max(-40, min(40, value))))


def logit(rate):
    return math.log(rate / (1 - rate))


def win_strength(wins, games):
    """20 fixed .500 pseudo-games; finite even for an unbeaten team."""
    return logit((wins + PRIOR_GAMES / 2) / (games + PRIOR_GAMES))


def generic_strength(rate):
    """Browser-equivalent strength for a displayed 162-game win pace."""
    return win_strength(rate * REFERENCE_GAMES, REFERENCE_GAMES)


def _fit(rows, home_only=False):
    slope, home = 0.0, 0.0
    for _ in range(60):
        gb, gh, hbb, hhh, hbh = RIDGE * slope, RIDGE * home, RIDGE, RIDGE, 0.0
        for x, venue, y in rows:
            x = 0 if home_only else x
            p = logistic(slope * x + home * venue)
            gb += (p - y) * x
            gh += (p - y) * venue
            variance = p * (1 - p)
            hbb += variance * x * x
            hhh += variance * venue * venue
            hbh += variance * x * venue
        determinant = hbb * hhh - hbh * hbh
        db = (gb * hhh - gh * hbh) / determinant
        dh = (gh * hbb - gb * hbh) / determinant
        slope, home = max(0, slope - db), home - dh
        if max(abs(db), abs(dh)) < 1e-10:
            break
    return {'slope': slope, 'homeLogOdds': home, 'ridgePenalty': RIDGE}


def _metrics(rows, fitted):
    ps = [logistic(fitted['slope'] * x + fitted['homeLogOdds'] * v) for x, v, _ in rows]
    n = len(rows)
    assert n
    return {'games': n, 'brier': sum((p - r[2]) ** 2 for p, r in zip(ps, rows)) / n,
            'logLoss': -sum(r[2] * math.log(p) + (1 - r[2]) * math.log(1 - p) for p, r in zip(ps, rows)) / n,
            'meanPredictedHomeWinCredit': sum(ps) / n,
            'observedHomeWinCredit': sum(r[2] for r in rows) / n}


def _calibration(rows, fitted):
    bins = [[] for _ in range(5)]
    for x, venue, y in rows:
        p = logistic(fitted['slope'] * x + fitted['homeLogOdds'] * venue)
        bins[min(4, int(p * 5))].append((p, y))
    return [{'from': i / 5, 'to': (i + 1) / 5, 'games': len(values),
             'predicted': sum(p for p, _ in values) / len(values),
             'observedWinCredit': sum(y for _, y in values) / len(values)}
            for i, values in enumerate(bins) if values]


def pregame_rows(games):
    """Capture only regular games completed strictly before the target date.

    Every game on a date shares a frozen snapshot, including doubleheaders.
    Suspended results become available on their completion date, never the
    original date. Playoff features freeze the completed regular season.
    """
    ids = [str(g['gameId']) for g in games]
    assert len(ids) == len(set(ids)), 'Duplicate MLB game IDs'
    rows, excluded = [], collections.Counter()
    for season, grouped in itertools.groupby(sorted(games, key=lambda g: (g['season'], g['date'], str(g['gameId']))), lambda g: g['season']):
        season_games = list(grouped)
        completed = sorted((g for g in season_games if g['phase'] == 'regular'),
                           key=lambda g: (g.get('completionDate', g['date'])[:10], str(g['gameId'])))
        # wins, games, runs scored, runs allowed, last completed date
        records = collections.defaultdict(lambda: [0, 0, 0, 0, ''])
        cursor = 0
        for date, on_date in itertools.groupby(season_games, lambda g: g['date'][:10]):
            while cursor < len(completed) and completed[cursor].get('completionDate', completed[cursor]['date'])[:10] < date:
                old = completed[cursor]
                for side, other in [('home', 'away'), ('away', 'home')]:
                    record = records[str(old[side + 'Id'])]
                    record[0] += int(old[side + 'Score'] > old[other + 'Score'])
                    record[1] += 1
                    record[2] += old[side + 'Score']
                    record[3] += old[other + 'Score']
                    record[4] = old.get('completionDate', old['date'])[:10]
                cursor += 1
            for game in on_date:
                home = records[str(game['homeId'])]
                away = records[str(game['awayId'])]
                if game['homeScore'] == game['awayScore']:
                    excluded['tiedGames'] += 1
                    continue
                if min(home[1], away[1]) < MIN_PRIOR_GAMES:
                    excluded['fewerThanTwentyPriorGames'] += 1
                    continue
                assert home[4] < date and away[4] < date
                rows.append({'gameId': str(game['gameId']), 'season': season, 'date': date,
                             'phase': game['phase'], 'recordThrough': max(home[4], away[4]),
                             'homeRecordThrough': home[4], 'awayRecordThrough': away[4],
                             'homeRecord': home[:2], 'awayRecord': away[:2],
                             'homeRuns': home[2:4], 'awayRuns': away[2:4],
                             'homeRate': home[0] / home[1], 'awayRate': away[0] / away[1],
                             'homeStrength': win_strength(home[0], home[1]),
                             'awayStrength': win_strength(away[0], away[1]),
                             'venue': 0 if game.get('neutral', False) else 1,
                             'outcome': int(game['homeScore'] > game['awayScore'])})
    return rows, dict(excluded)


def _knots(records):
    counts = collections.Counter(round(r['wins'] / r['games'], 12) for r in records)
    before, points, total = 0, [], len(records)
    for rate, count in sorted(counts.items()):
        points.append([rate, (before + count / 2 + .5) / (total + 1), count])
        before += count
    return points


def _rank(rate, points):
    i = bisect.bisect_left([p[0] for p in points], rate)
    if i == 0:
        return points[0][1]
    if i == len(points):
        return points[-1][1]
    lo, hi = points[i - 1], points[i]
    return lo[1] + (hi[1] - lo[1]) * (rate - lo[0]) / (hi[0] - lo[0])


def _design(features, kind, mean_runs, points):
    def strength(row, side):
        wins, games = row[side + 'Record']
        if kind == 'wins':
            return win_strength(wins, games)
        if kind == 'runs':
            runs_for, runs_against = row[side + 'Runs']
            prior = PRIOR_GAMES * mean_runs
            return PYTHAGOREAN_EXPONENT * math.log((runs_for + prior) / (runs_against + prior))
        if kind == 'regularRarity':
            return logit(_rank((wins + PRIOR_GAMES / 2) / (games + PRIOR_GAMES), points))
        if kind == 'legacyPlayoffRarity':
            return logit(_rank(wins / games, points))
        raise ValueError('Unknown MLB candidate: ' + kind)
    return [(strength(r, 'home') - strength(r, 'away'), r['venue'], r['outcome']) for r in features]


def build_mlb(games, season_records):
    """Return fit, validation, playoffValidation, comparison and featureAudit.

    season_records supply the record-rarity reference for retained challengers.
    This is the retained pregame research reference; the current app uses regular.py.
    All model choices are fixed in this file, not optimized on 2022–24 results.
    That test period was already examined during project development: results
    are a temporal retrospective comparison, not an untouched confirmation.
    """
    rows, excluded = pregame_rows(games)
    training = [r for r in rows if r['phase'] == 'regular' and r['season'] <= TRAIN_END]
    test_regular = [r for r in rows if r['phase'] == 'regular' and r['season'] > TRAIN_END]
    test_playoff = [r for r in rows if r['phase'] == 'playoff' and r['season'] > TRAIN_END]
    regular = [r for r in rows if r['phase'] == 'regular']
    source_training = [g for g in games if g['phase'] == 'regular' and g['season'] <= TRAIN_END]
    mean_runs = sum(g['homeScore'] + g['awayScore'] for g in source_training) / (2 * len(source_training))
    train_points = _knots([r for r in season_records if int(r['season']) <= TRAIN_END])
    all_points = _knots(season_records)
    design = lambda values, kind='wins': _design(values, kind, mean_runs, train_points)
    train, test, playoff = design(training), design(test_regular), design(test_playoff)
    fitted, home = _fit(train), _fit(train, True)
    coin = {'slope': 0, 'homeLogOdds': 0}

    def validation(target, label):
        return {'recordMetric': 'pre-game wins with 20 average prior games',
                'training': '2015–2021 regular seasons; both teams after 20 prior games',
                'test': label, 'trainingGames': len(train), 'trainingFit': fitted,
                'model': _metrics(target, fitted), 'homeOnly': _metrics(target, home),
                'coinFlip': _metrics(target, coin), 'calibration': _calibration(target, fitted),
                'drawGames': 0, 'tieScoring': 'One tied regular-season game excluded from binary evaluation',
                'testStatus': 'Previously examined temporal holdout; not untouched confirmation'}

    regular_validation = validation(test, '2022–2024 regular seasons; both teams after 20 prior games')
    playoff_validation = validation(playoff, '2022–2024 postseasons; regular-season-trained model')
    playoff_validation['scope'] = 'Transfer test, not a fit to postseason outcomes'
    playoff_validation['warning'] = 'Did not beat home-only or 50–50 on 124 playoff games; no validated postseason advantage.'
    candidates = {}
    for kind in ['wins', 'runs', 'regularRarity', 'legacyPlayoffRarity']:
        candidate_training = training if kind != 'legacyPlayoffRarity' else [r for r in rows if r['phase'] == 'playoff' and r['season'] <= TRAIN_END]
        candidate_fit = _fit(design(candidate_training, kind))
        candidates[kind] = {'trainingGames': len(candidate_training), 'trainingFit': candidate_fit,
                            'regularSeason': _metrics(design(test_regular, kind), candidate_fit),
                            'postseason': _metrics(design(test_playoff, kind), candidate_fit),
                            'usedInApp': False}
    all_design = _design(regular, 'wins', mean_runs, all_points)
    production = _fit(all_design)
    production.update({'strengthScale': 'smoothedWinLogit', 'priorGames': PRIOR_GAMES,
                       'referenceGames': REFERENCE_GAMES, 'minimumPriorGames': MIN_PRIOR_GAMES,
                       'recordMetric': 'pre-game wins with 20 average prior games',
                       'games': len(regular), 'scope': 'Regular-season games after 20 prior games',
                       'window': '2015 to 2024', 'drawGames': 0,
                       'featureTiming': 'Regular-season games completed before match day; at least 20 prior games per club',
                       'maxAbsStrengthGap': max(abs(x) for x, _, _ in all_design),
                       'postseasonValidated': False})
    individual = [win_strength(*r[side + 'Record']) for r in regular for side in ['home', 'away']]
    production['individualStrengthRange'] = [min(individual), max(individual)]
    comparison = {'schemaVersion': 2, 'selected': 'completedSeasonRarity', 'preferredPregameCandidate': 'wins',
                  'rationale': 'The v8 app uses completed-season other-opponent rarity from regular.py. These pregame candidates are retained as separate research comparisons. Runs require actual run totals, not an inferred wins-only input.',
                  'training': '2015–2021', 'test': '2022–2024',
                  'holdoutCaveat': 'These seasons were previously examined. This comparison is exploratory and does not establish untouched future-season performance.',
                  'fixedChoices': {'minimumPriorGames': MIN_PRIOR_GAMES, 'priorGames': PRIOR_GAMES,
                                   'runExponent': PYTHAGOREAN_EXPONENT, 'ridgePenalty': RIDGE,
                                   'trainingMeanRunsPerTeam': mean_runs,
                                   'selection': 'The wins model is the retained pregame reference; none of these pregame candidates is used by the current app.'},
                  'candidates': candidates,
                  'baselines': {'homeOnly': {'trainingFit': home, 'regularSeason': _metrics(test, home), 'postseason': _metrics(playoff, home)},
                                'coinFlip': {'regularSeason': _metrics(test, coin), 'postseason': _metrics(playoff, coin)}},
                  'sources': [{'title': 'MLB Pythagorean winning percentage', 'url': 'https://www.mlb.com/glossary/advanced-stats/pythagorean-winning-percentage',
                               'use': 'Runs scored and allowed supply expected-win strength; benchmark exponent is 1.83.'},
                              {'title': 'FanGraphs game odds methodology', 'url': 'https://blogs.fangraphs.com/home-field-advantage-and-our-new-game-odds/',
                               'use': 'Motivates pitcher and lineup inputs for a future matchup model; neither is present here.'}],
                  'limitations': ['No pitcher, lineup, bullpen, park, schedule-strength, or injury inputs.',
                                  'The 20-game .500 prior and minimum sample size are explicit fixed modeling choices, not measured facts.',
                                  'Generic 162-game win pace uses 162 games of evidence; actual validation uses the record length available before each game.',
                                  'Postseason series still compose game probabilities with independence assumptions; not directly validated series predictions.']}
    audit = {'scope': 'Regular-season pregame records; outcomes after at least 20 completed prior games for both teams',
             'inputGameCounts': dict(sorted(collections.Counter(str(g['season']) + ' ' + g['phase'] for g in games).items())),
             'excluded': excluded, 'minimumPriorGames': MIN_PRIOR_GAMES,
             'featureTiming': 'Only games with completionDate strictly before target game date; all same-date games freeze together',
             'rows': regular}
    return {'fit': production, 'validation': regular_validation, 'playoffValidation': playoff_validation,
            'comparison': comparison, 'featureAudit': audit}


if __name__ == '__main__':
    import json
    from pathlib import Path
    root = Path(__file__).resolve().parents[2]
    data = root / 'data/history'
    games = json.loads((data / 'mlb-games.json').read_text())
    records = [r for r in json.loads((data / 'other-team-seasons.json').read_text())['teamSeasons']
               if r['sport'] == 'mlb' and r['included']]
    result = build_mlb(games, records)
    (data / 'mlb-model-comparison.json').write_text(json.dumps(result['comparison'], indent=2) + '\n')
    print(json.dumps({key: result[key] for key in ['fit', 'validation', 'playoffValidation']}, indent=2))
