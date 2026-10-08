"""Regression checks for all-team season-end lookbacks and postseason isolation."""
import collections
import copy
import json
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts/history'))
from regular import lookback_rows


def fixture(i, home, away, hs=3, away_score=1, phase='regular', sport='nba'):
    return {'sport': sport, 'gameId': str(i), 'season': 2024,
            'date': '2024-04-%02d' % i if phase == 'regular' else '2024-05-01',
            'homeId': home, 'awayId': away, 'homeScore': hs, 'awayScore': away_score,
            'phase': phase, 'neutral': False,
            'homeStandingsPoints': 2 if hs > away_score else 0,
            'awayStandingsPoints': 2 if away_score > hs else 0}


class HeadToHeadExclusion(unittest.TestCase):
    def test_changing_all_head_to_heads_cannot_change_their_strength_features(self):
        for sport in ['nba', 'nhl', 'mlb', 'nfl']:
            games = [fixture(1, 'A', 'B', sport=sport), fixture(2, 'B', 'A', sport=sport),
                     fixture(3, 'A', 'C', sport=sport), fixture(4, 'C', 'A', sport=sport),
                     fixture(5, 'B', 'C', sport=sport), fixture(6, 'C', 'B', sport=sport),
                     fixture(7, 'A', 'B', phase='playoff', sport=sport)]
            original, _ = lookback_rows(games, sport)
            modified = copy.deepcopy(games)
            for g in modified:
                if {g['homeId'], g['awayId']} == {'A', 'B'}:
                    g['homeScore'], g['awayScore'] = g['awayScore'], g['homeScore']
                    g['homeStandingsPoints'], g['awayStandingsPoints'] = g['awayStandingsPoints'], g['homeStandingsPoints']
            after, _ = lookback_rows(modified, sport)
            for before, changed in zip(original, after):
                if {before['homeId'], before['awayId']} == {'A', 'B'}:
                    for key in ['homeRecord', 'awayRecord', 'homeRate', 'awayRate', 'excludedGameIds']:
                        self.assertEqual(before[key], changed[key])
                    self.assertEqual(before['excludedGameIds'], ['1', '2'])
                    self.assertEqual(before['homeRecord'][1], 2)
                    self.assertNotEqual(before['outcome'], changed['outcome'])

    def test_tied_nfl_game_counts_in_denominator_but_never_as_a_loss_target(self):
        games = [fixture(1, 'A', 'B', sport='nfl'), fixture(2, 'A', 'C', 7, 7, sport='nfl'),
                 fixture(3, 'B', 'C', sport='nfl')]
        rows, excluded = lookback_rows(games, 'nfl')
        self.assertEqual([r['gameId'] for r in excluded], ['2'])
        target = next(r for r in rows if r['gameId'] == '1')
        self.assertEqual(target['homeRecord'], [0, 1])
        self.assertEqual(target['homeFullRecord'], [1, 2])

    def test_nhl_official_points_allow_overtime_and_forfeiture_exceptions(self):
        games = [fixture(1, 'A', 'B', sport='nhl'), fixture(2, 'A', 'C', 1, 2, sport='nhl'),
                 fixture(3, 'B', 'C', sport='nhl')]
        games[1]['homeStandingsPoints'] = 1
        rows, _ = lookback_rows(games, 'nhl')
        self.assertEqual(rows[0]['homeRecord'], [1, 1])
        games[1]['homeStandingsPoints'] = 0  # Official OT point forfeiture.
        rows, _ = lookback_rows(games, 'nhl')
        self.assertEqual(rows[0]['homeRecord'], [0, 1])

    def test_mlb_ties_and_completion_dates(self):
        games = [fixture(1, 'A', 'B', sport='mlb'), fixture(2, 'A', 'C', 3, 3, sport='mlb'),
                 fixture(3, 'B', 'C', sport='mlb'), fixture(4, 'A', 'B', phase='playoff', sport='mlb')]
        games[1]['completionDate'] = '2024-04-29'
        games[0]['neutral'] = None  # Explicit retained designated-home assumption.
        rows, excluded = lookback_rows(games, 'mlb')
        self.assertEqual([r['gameId'] for r in excluded], ['2'])
        self.assertEqual(rows[0]['homeRecord'], [0, 1])
        self.assertEqual(rows[0]['venue'], 1)
        playoff = next(r for r in rows if r['phase'] == 'playoff')
        self.assertEqual(playoff['homeRecordThrough'], '2024-04-29')
        games[1]['completionDate'] = '2024-05-02'
        with self.assertRaises(AssertionError): lookback_rows(games, 'mlb')

    def test_unknown_neutral_status_is_rejected(self):
        g = fixture(1, 'A', 'B'); g['neutral'] = None
        with self.assertRaisesRegex(AssertionError, 'venue'):
            lookback_rows([g], 'nba')


class AllTeamSnapshot(unittest.TestCase):
    def test_every_feature_reconciles_to_games_against_other_opponents(self):
        audit = json.loads((ROOT / 'data/history/feature-audit.json').read_text())
        for sport, count in [('nba', 11979), ('nhl', 12200), ('nfl', 2614), ('mlb', 22762)]:
            games = json.loads((ROOT / ('data/history/' + sport + '-games.json')).read_text())
            records = collections.defaultdict(lambda: [0, 0])
            pair_records = collections.defaultdict(lambda: [0, 0])
            pairs = collections.defaultdict(list)
            def credit(g, side):
                if sport == 'nhl': return g[side + 'StandingsPoints']
                return int(g[side + 'Score'] > g[('away' if side == 'home' else 'home') + 'Score'])
            for g in games:
                if g['phase'] != 'regular': continue
                pair = (g['season'], tuple(sorted([g['homeId'], g['awayId']])))
                pairs[pair].append(g['gameId'])
                for side in ['home', 'away']:
                    key = (g['season'], g[side + 'Id'])
                    records[key][0] += credit(g, side); records[key][1] += 1
                    pair_records[(pair, g[side + 'Id'])][0] += credit(g, side)
                    pair_records[(pair, g[side + 'Id'])][1] += 1
            rows = audit['mlbLookback' if sport == 'mlb' else sport]['rows']
            self.assertEqual(sum(r['phase'] == 'regular' for r in rows), count)
            self.assertGreater(sum(r['phase'] == 'regular' and not r['homeReachedPlayoffs'] and not r['awayReachedPlayoffs'] for r in rows), 0)
            for r in rows:
                pair = (r['season'], tuple(sorted([r['homeId'], r['awayId']])))
                self.assertEqual(r['excludedGameIds'], sorted(pairs[pair]))
                for side in ['home', 'away']:
                    full, removed = records[(r['season'], r[side + 'Id'])], pair_records[(pair, r[side + 'Id'])]
                    remaining = [full[i] - removed[i] for i in range(2)]
                    self.assertEqual(r[side + 'FullRecord'], full)
                    self.assertEqual(r[side + 'Record'], remaining)
                    self.assertAlmostEqual(r[side + 'Rate'], remaining[0] / (remaining[1] * (2 if sport == 'nhl' else 1)))
                    if r['phase'] == 'playoff': self.assertLess(r[side + 'RecordThrough'], r['date'])
            self.assertEqual(len(records), {'nba': 300, 'nhl': 312, 'nfl': 320, 'mlb': 300}[sport])

if __name__ == '__main__':
    unittest.main()
