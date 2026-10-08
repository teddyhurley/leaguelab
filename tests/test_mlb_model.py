"""Run with python3 -m unittest discover -s tests -p 'test_mlb_model.py'."""
import copy
import json
import math
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts/history'))
from mlb import build_mlb, generic_strength, pregame_rows, win_strength


def game(game_id, date, home_score=4, away_score=2, completion=None, phase='regular'):
    return {'gameId': str(game_id), 'sport': 'mlb', 'season': 2024, 'date': date,
            'completionDate': completion or date, 'phase': phase,
            'homeId': 'A', 'awayId': 'B', 'homeScore': home_score,
            'awayScore': away_score, 'neutral': False}


class MlbFeatureSafety(unittest.TestCase):
    def test_same_day_and_suspended_results_are_not_available(self):
        games = [game(i, '2024-04-%02d' % i) for i in range(1, 21)]
        games += [game(100, '2024-04-05', 99, 98, '2024-04-25'),
                  game(101, '2024-04-21', 9, 1), game(102, '2024-04-21', 1, 9),
                  game(103, '2024-04-26')]
        rows, _ = pregame_rows(games)
        by_id = {r['gameId']: r for r in rows}
        for target in ['101', '102']:
            self.assertEqual(by_id[target]['homeRecord'], [20, 20])
            self.assertEqual(by_id[target]['homeRuns'], [80, 40])
            self.assertEqual(by_id[target]['recordThrough'], '2024-04-20')
        self.assertEqual(by_id['103']['homeRecord'], [22, 23])
        self.assertEqual(by_id['103']['homeRuns'], [189, 148])
        self.assertEqual(by_id['103']['recordThrough'], '2024-04-25')

    def test_postseason_results_never_enter_later_features(self):
        games = [game(i, '2024-04-%02d' % i) for i in range(1, 21)]
        games += [game(101, '2024-10-01', 20, 0, phase='playoff'),
                  game(102, '2024-10-02', phase='playoff')]
        rows, _ = pregame_rows(games)
        first, second = [r for r in rows if r['phase'] == 'playoff']
        self.assertEqual(first['homeRecord'], second['homeRecord'])
        self.assertEqual(first['homeRuns'], second['homeRuns'])
        self.assertEqual(first['homeRecord'], [20, 20])

    def test_wins_scale_is_finite_symmetric_and_matches_browser_contract(self):
        for wins in [0, 40, 81, 90, 120, 162]:
            value = generic_strength(wins / 162)
            self.assertTrue(math.isfinite(value))
            self.assertAlmostEqual(value, win_strength(wins, 162))
            self.assertAlmostEqual(value, -generic_strength(1 - wins / 162))
        self.assertEqual(generic_strength(.5), 0)


class MlbSnapshotEvidence(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        data = ROOT / 'data/history'
        cls.games = json.loads((data / 'mlb-games.json').read_text())
        records = json.loads((data / 'rarity-reference.json').read_text())['sports']['mlb']['teamSeasons']
        cls.result = build_mlb(cls.games, records)

    def test_counts_and_temporal_feature_audit(self):
        result = self.result
        self.assertEqual(result['fit']['games'], 19651)
        self.assertEqual(result['validation']['trainingGames'], 13286)
        self.assertEqual(result['validation']['model']['games'], 6365)
        self.assertEqual(result['playoffValidation']['model']['games'], 124)
        self.assertEqual(result['featureAudit']['excluded']['tiedGames'], 1)
        for row in result['featureAudit']['rows']:
            self.assertLess(row['recordThrough'], row['date'])
            self.assertGreaterEqual(min(row['homeRecord'][1], row['awayRecord'][1]), 20)
            self.assertEqual(row['phase'], 'regular')

    def test_early_features_cannot_see_later_completion_of_real_suspended_game(self):
        # Kansas City / New York, begun May 19 and completed September 6, 2019.
        modified = copy.deepcopy(self.games)
        suspended = next(g for g in modified if str(g['gameId']) == '565534')
        suspended['homeScore'] += 1000
        original, _ = pregame_rows(self.games)
        altered, _ = pregame_rows(modified)
        by_id = {r['gameId']: r for r in altered}
        for row in original:
            if row['season'] == 2019 and row['date'] <= suspended['completionDate']:
                for key in ['homeRecord', 'awayRecord', 'homeRuns', 'awayRuns']:
                    self.assertEqual(row[key], by_id[row['gameId']][key])

    def test_regular_improvement_does_not_hide_failed_playoff_transfer(self):
        regular, playoff = self.result['validation'], self.result['playoffValidation']
        self.assertLess(regular['model']['brier'], regular['homeOnly']['brier'])
        self.assertGreater(playoff['model']['brier'], playoff['homeOnly']['brier'])
        self.assertGreater(playoff['model']['brier'], playoff['coinFlip']['brier'])
        self.assertFalse(self.result['fit']['postseasonValidated'])
        self.assertEqual(self.result['fit']['strengthScale'], 'smoothedWinLogit')

    def test_comparison_snapshot_is_reproducible(self):
        expected = json.loads((ROOT / 'data/history/mlb-model-comparison.json').read_text())
        def compare(a, b):
            if isinstance(a, dict):
                self.assertEqual(set(a), set(b))
                for key in a:
                    compare(a[key], b[key])
            elif isinstance(a, list):
                self.assertEqual(len(a), len(b))
                for left, right in zip(a, b):
                    compare(left, right)
            elif isinstance(a, float):
                self.assertTrue(math.isfinite(b))
                self.assertAlmostEqual(a, b, delta=1e-10 * max(1, abs(a)))
            else:
                self.assertEqual(a, b)
        compare(self.result['comparison'], expected)


if __name__ == '__main__':
    unittest.main()
