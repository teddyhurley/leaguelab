"""All-team NBA/NHL/MLB/NFL season-end lookbacks, with isolated playoff checks.

Every regular-season meeting between the two clubs is removed from both
records. Remaining games include future information: retrospective, not a
pregame forecast. The playoff transfer uses the same other-opponent records,
which are complete before those clubs' playoff game.
"""
import collections
import math
from binary import fit, metrics, logistic
from empirical import calibration


def earned(g, side, sport):
    if sport == 'nhl':
        # Official game rows preserve rare forfeited OT points, not just period.
        value = g[side + 'StandingsPoints']
        assert value in (0, 1, 2)
        return value
    other = 'away' if side == 'home' else 'home'
    return int(g[side + 'Score'] > g[other + 'Score'])


def lookback_rows(games, sport):
    assert sport in ('nba', 'nhl', 'mlb', 'nfl')
    ids = [str(g['gameId']) for g in games]
    assert len(ids) == len(set(ids)), 'Duplicate games'
    seasons = collections.defaultdict(list)
    for g in games:
        # MLB's source marks known neutral games; otherwise designated home is
        # the retained, disclosed assumption. NBA/NHL/NFL require audited flags.
        assert isinstance(g['neutral'], bool) or sport == 'mlb' and g['neutral'] is None, 'Missing audited venue status'
        assert g['phase'] in ('regular', 'playoff')
        assert str(g['homeId']) != str(g['awayId'])
        seasons[g['season']].append(g)
    rows, excluded = [], []
    for season, matches in sorted(seasons.items()):
        records = collections.defaultdict(lambda: [0, 0])
        through, pairs = {}, collections.defaultdict(list)
        playoff_teams = set()
        for g in matches:
            if g['phase'] == 'playoff':
                playoff_teams.update([str(g['homeId']), str(g['awayId'])])
                continue
            pairs[tuple(sorted([str(g['homeId']), str(g['awayId'])]))].append(g)
            for side in ('home', 'away'):
                team = str(g[side + 'Id'])
                records[team][0] += earned(g, side, sport)
                records[team][1] += 1
                through[team] = max(through.get(team, ''), g.get('completionDate', g['date'])[:10])
        for g in sorted(matches, key=lambda g: (g['date'], str(g['gameId']))):
            if g['homeScore'] == g['awayScore']:
                assert sport in ('nfl', 'mlb') and g['phase'] == 'regular'
                excluded.append({'gameId': str(g['gameId']), 'season': season,
                                 'reason': 'Tied %s game: retained in record denominators, excluded from binary target' % sport.upper()})
                continue
            pair = tuple(sorted([str(g['homeId']), str(g['awayId'])]))
            meetings = pairs[pair]
            row = {'gameId': str(g['gameId']), 'season': season, 'date': g['date'][:10],
                   'phase': g['phase'], 'homeId': str(g['homeId']), 'awayId': str(g['awayId']),
                   'featureTiming': 'Season end, excluding all regular-season head-to-head meetings',
                   'excludedGameIds': sorted(str(m['gameId']) for m in meetings),
                   'venue': 0 if g['neutral'] else 1,
                   'outcome': int(g['homeScore'] > g['awayScore'])}
            for side in ('home', 'away'):
                team = str(g[side + 'Id'])
                units, played = records[team]
                assert played > 0, 'Missing regular-season record'
                row[side + 'FullRecord'] = [units, played]
                for m in meetings:
                    own = 'home' if str(m['homeId']) == team else 'away'
                    units -= earned(m, own, sport)
                    played -= 1
                assert played > 0 and 0 <= units <= played * (2 if sport == 'nhl' else 1)
                row[side + 'Record'] = [units, played]
                row[side + 'Rate'] = units / (played * (2 if sport == 'nhl' else 1))
                row[side + 'ReachedPlayoffs'] = team in playoff_teams
                row[side + 'RecordThrough'] = through[team]
                if g['phase'] == 'playoff':
                    assert through[team] < row['date'], 'Playoff features use future regular games'
            if g['phase'] == 'regular':
                assert row['gameId'] in row['excludedGameIds']
            rows.append(row)
    return rows, excluded


def build_regular(games, sport, cohort, knots, rank):
    cutoff = 2021 if sport in ('nfl', 'mlb') else 2022
    logit = lambda p: math.log(p / (1 - p))
    rows, excluded = lookback_rows(games, sport)
    regular = [r for r in rows if r['phase'] == 'regular']
    train = [r for r in regular if r['season'] <= cutoff]
    test = [r for r in regular if r['season'] > cutoff]
    playoff_train = [r for r in rows if r['phase'] == 'playoff' and r['season'] <= cutoff]
    playoff_test = [r for r in rows if r['phase'] == 'playoff' and r['season'] > cutoff]
    training_knots = knots([r for r in cohort if r['seasonEnd'] <= cutoff], sport)
    production_knots = knots(cohort, sport)
    def strength(r, side, points):
        return logit(rank(r[side + 'Rate'], points))
    def design(values, points=training_knots):
        return [(strength(r, 'home', points) - strength(r, 'away', points), r['venue'], r['outcome']) for r in values]
    trained, home = fit(design(train)), fit(design(train), True)
    coin = {'slope': 0, 'homeLogOdds': 0}
    train_label = '2015–2021' if sport in ('nfl', 'mlb') else '2015–16 to 2021–22'
    test_label = '2022–2024' if sport in ('nfl', 'mlb') else '2022–23 to 2024–25'
    def check(values, label):
        d = design(values)
        return {'recordMetric': 'Other-opponent season-end points percentage' if sport == 'nhl' else 'Other-opponent season-end win percentage',
                'training': train_label + ' regular seasons', 'test': test_label + ' ' + label,
                'trainingGames': len(train), 'trainingFit': trained,
                'model': metrics(d, trained), 'homeOnly': metrics(d, home), 'coinFlip': metrics(d, coin),
                'metric': 'Binary Brier', 'calibration': calibration(d, trained, logistic),
                'interpretation': 'Retrospective association, not pregame forecasting accuracy' if label == 'regular seasons' else 'Regular-season-trained model transferred to playoff games',
                'testStatus': 'Previously inspected evaluation periods; exploratory model revision',
                'drawGames': 0, 'tieScoring': 'Tied MLB/NFL games stay in record denominators but are excluded as targets; other games choose a winner'}
    validation = check(test, 'regular seasons')
    subsets = {
        'nonPlayoffParticipants': [r for r in test if not r['homeReachedPlayoffs'] or not r['awayReachedPlayoffs']],
        'bothMissedPlayoffs': [r for r in test if not r['homeReachedPlayoffs'] and not r['awayReachedPlayoffs']],
        'bothReachedPlayoffs': [r for r in test if r['homeReachedPlayoffs'] and r['awayReachedPlayoffs']]}
    validation['subgroups'] = {name: {'model': metrics(design(values), trained), 'homeOnly': metrics(design(values), home), 'coinFlip': metrics(design(values), coin)}
                               for name, values in subsets.items() if values}
    validation['subgroupDefinition'] = 'Playoff participation means appearing in the retained main playoff bracket that season; NHL 2020 qualifiers are not retained.'
    playoff = check(playoff_test, 'playoffs')
    playoff_refit, playoff_home = fit(design(playoff_train)), fit(design(playoff_train), True)
    playoff['scope'] = 'Separate playoff transfer check; regular baseline remains the app default'
    playoff['playoffRefit'] = {'trainingGames': len(playoff_train), 'trainingFit': playoff_refit,
                               'model': metrics(design(playoff_test), playoff_refit), 'homeOnly': metrics(design(playoff_test), playoff_home),
                               'usedInApp': False,
                               'note': 'Separate coefficients trained on earlier playoffs. Exploratory comparison, not an automatically applied playoff adjustment.'}
    all_design = design(regular, production_knots)
    production = fit(all_design)
    individual = [strength(r, side, production_knots) for r in regular for side in ('home', 'away')]
    production.update({'strengthScale': 'rarityLogit', 'recordMetric': validation['recordMetric'],
                       'games': len(regular), 'scope': 'Regular-season lookback · all teams',
                       'window': '2015 to 2024' if sport in ('nfl', 'mlb') else '2015–16 to 2024–25',
                       'featureTiming': 'Season-end records against other opponents; all head-to-head meetings removed. Uses hindsight.',
                       'retrospective': True, 'drawGames': 0, 'excludedTiedTargets': len(excluded),
                       'maxAbsStrengthGap': max(abs(r[0]) for r in all_design),
                       'individualStrengthRange': [min(individual), max(individual)],
                       'supportNote': 'Individual strength and gap ranges are coverage checks, not proof of calibration at every matchup.',
                       'regularGameCount': sum(g['phase'] == 'regular' for g in games),
                       'teamSeasons': len(set((r['season'], r[side + 'Id']) for r in regular for side in ('home', 'away'))),
                       'playoffAdjustmentApplied': False})
    if sport == 'mlb':
        production['venueAssumption'] = 'Known neutral games use venue=0; other designated home teams use venue=1, including missing neutral flags.'
    audit = {'scope': production['scope'], 'featureTiming': production['featureTiming'],
             'inputGameCounts': dict(sorted(collections.Counter(str(g['season']) + ' ' + g['phase'] for g in games).items())),
             'excluded': {'tiedTargets': excluded}, 'rows': rows}
    return {'fit': production, 'validation': validation, 'playoffValidation': playoff, 'featureAudit': audit}
