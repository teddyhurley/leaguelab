"""Tests protecting the release comparison's timing and scoring claims."""
import copy
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts/history'))
from evaluate_release import loss, mlb_lookbacks, paired_comparison, rank_knots, rolling_splits


class ReleaseEvaluation(unittest.TestCase):
    def test_rolling_training_never_uses_target_or_future_seasons(self):
        rows = [{'season': y} for y in range(2015, 2025)]
        splits = list(rolling_splits(rows))
        self.assertEqual([s[0] for s in splits], list(range(2020, 2025)))
        for year, train, test in splits:
            self.assertTrue(all(r['season'] < year for r in train))
            self.assertEqual({r['season'] for r in test}, {year})
        sensitivity = list(rolling_splits(rows, {2020}))
        self.assertEqual(len(sensitivity), 4)
        self.assertTrue(all(r['season'] != 2020 for _, train, _ in sensitivity for r in train))

    def test_future_reference_rows_cannot_change_training_ranks(self):
        rows = [{'seasonEnd': 2019, 'wins': 40, 'games': 82}, {'seasonEnd': 2020, 'wins': 60, 'games': 82}]
        before = rank_knots(rows, 'nba', 2019)
        rows[1]['wins'] = 1
        self.assertEqual(before, rank_knots(rows, 'nba', 2019))

    def test_mlb_lookback_excludes_every_meeting_even_in_playoff_targets(self):
        rows = []
        for i, (home, away, phase) in enumerate([('A','B','regular'),('B','A','regular'),('A','C','regular'),('B','C','regular'),('A','B','playoff')]):
            rows.append({'gameId': str(i), 'season': 2024, 'phase': phase, 'date': '2024-10-01' if phase == 'playoff' else '2024-04-01',
                         'homeId': home, 'awayId': away, 'homeScore': 4, 'awayScore': 2, 'neutral': False})
        original = mlb_lookbacks(rows)
        changed = copy.deepcopy(rows)
        for r in changed:
            if {r['homeId'], r['awayId']} == {'A','B'}: r['homeScore'], r['awayScore'] = r['awayScore'], r['homeScore']
        after = mlb_lookbacks(changed)
        for a, b in zip(original, after):
            if {a['homeId'],a['awayId']} == {'A','B'}:
                self.assertEqual(a['excludedGameIds'], ['0','1'])
                self.assertEqual(a['homeRecord'], b['homeRecord'])
                self.assertEqual(a['awayRecord'], b['awayRecord'])
                self.assertNotEqual(a['outcome'], b['outcome'])

    def test_binary_and_categorical_losses_have_distinct_baselines(self):
        self.assertEqual(loss([.5], 1)[0], .25)
        self.assertAlmostEqual(loss([1/3]*3, .5)[0], 2/3)
        self.assertEqual(loss([0,1,0], .5)[0], 0)

    def test_paired_uncertainty_resamples_seasons_not_games(self):
        a = [{'id': str(y), 'season': y, 'p': [.8], 'y': 1} for y in range(2020,2025)]
        b = [{**r, 'p': [.5]} for r in a]
        result = paired_comparison(a,b)
        self.assertAlmostEqual(result['equalSeasonBrierDelta'], -.21)
        self.assertEqual(result['seasonsBetter'], 5)
        self.assertAlmostEqual(result['seasonBootstrap95'][1], -.21)
        with self.assertRaises(AssertionError): paired_comparison(a,b[::-1])


if __name__ == '__main__': unittest.main()
