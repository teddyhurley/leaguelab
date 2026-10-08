"""Independent checks of the season-end feature exclusion and categorical fit."""
import copy
import json
import math
import sys
import unittest
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts/history'))
from soccer import lookback_rows, fit_three_way, probabilities, three_way_metrics

class SoccerModelTests(unittest.TestCase):
    def test_both_target_results_cannot_change_their_own_strength(self):
        games = [g for g in json.loads((ROOT/'data/history/soccer-games.json').read_text()) if g['season'] == 2025]
        rows = lookback_rows(games)
        row = rows[0]
        changed = copy.deepcopy(games)
        for g in changed:
            if g['gameId'] in row['excludedGameIds']:
                g['homeScore'], g['awayScore'] = 30, 0
        other = {r['gameId']:r for r in lookback_rows(changed)}
        for original in rows:
            if original['gameId'] in row['excludedGameIds']:
                for key in ['homeRecord', 'awayRecord', 'homeRate', 'awayRate']:
                    self.assertEqual(original[key], other[original['gameId']][key])

    def test_draw_intercept_recovers_observed_rate_without_strength(self):
        rows = [(0., 0., y) for y in [1]*30+[.5]*40+[0]*30]
        fit = fit_three_way(rows)
        for p, expected in zip(probabilities(fit,0,0),[.3,.4,.3]):
            self.assertAlmostEqual(p,expected,places=9)
        self.assertAlmostEqual(three_way_metrics(rows,fit)['brier'], .66)
        self.assertAlmostEqual(three_way_metrics(rows,{'slope':0,'homeLogOdds':0,'drawLogWeight':0})['brier'], 2/3)

if __name__ == '__main__':
    unittest.main()
