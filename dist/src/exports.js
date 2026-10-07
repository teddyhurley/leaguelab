import { HISTORY } from './history-data.js';
import { validateConfig } from './presets.js';

export function experimentLink(config, origin) {
  const url = new URL(origin);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Shareable links need a hosted app. Download JSON to save this local experiment.');
  url.search = ''; url.searchParams.set('experiment', btoa(JSON.stringify(validateConfig(config)))); url.hash = 'simulator'; return url.href;
}
export function configFromLink(url, onMigrate = () => {}) {
  const encoded = new URL(url).searchParams.get('experiment');
  if (!encoded) return null;
  if (encoded.length > 5000) throw new Error('This experiment link is too long.');
  const input = JSON.parse(atob(encoded)), config = validateConfig(input);
  if ([2, 3].includes(input.version)) onMigrate('Saved experiment upgraded: NHL and Premier League win records are translated to equivalent points rarity. NHL now uses a points-based fit, so earlier odds may change.');
  else if (input.version === 4) onMigrate('Saved experiment upgraded to historical game fits for all five sports. Your records and settings are preserved; MLB, NFL and Premier League odds may change.');
  return config;
}
export function exportJSON(result) {
  return JSON.stringify({ ...result, interpretation: 'Historical game fits in all five sports: four postseason models and a pre-match Premier League model with half-win credit for draws. MLB failed to beat the home-only holdout baseline. Series and counterfactual mechanics remain model-based. Intervals quantify Monte Carlo error, not real-world predictive uncertainty.' }, null, 2);
}
export function exportCSV(result) {
  const header = ['model_version', 'scenario', 'sport', 'record_sport_a', 'record_sport_b', 'comparison_mode', 'benchmark_rank', 'focal_team', 'reference_record_a', 'reference_record_unit_a', 'reference_record_b', 'reference_record_unit_b', 'matching', 'basis', 'season_games', 'record_unit', 'focal_record_pace', 'opponent_record_pace', 'focal_strength_rank', 'opponent_strength_rank', 'series', 'scoring_multiplier', 'opportunity_multiplier', 'sensitivity_multiplier', 'volatility', 'noise_multiplier', 'home_edge', 'home_seed', 'rest_edge', 'seed', 'trials', 'focal_team_trial_wins', 'simulation_probability', 'ci_low', 'ci_high', 'exact_probability', 'game_one_advancement', 'game_one_regulation_tie', 'expected_games', 'result_role', 'opponent_simulation_probability', 'opponent_exact_probability', 'opponent_trial_wins', 'evidence_kind', 'fit_games', 'fit_scope', 'weak_validation', 'outside_fitted_gap'];
  const rows = ['left', 'right'].map(side => {
    const s = result.config[side], r = result[side], c = result.config;
    return [result.modelVersion, side, s.sport, c.recordSportA, c.recordSportB, c.comparison, c.opponentRank, r.subject, c.recordA, HISTORY[c.recordSportA].recordUnit, c.recordB, HISTORY[c.recordSportB].recordUnit, c.matching, c.basis, r.matchup.a.games, r.matchup.a.unit, r.matchup.a.value, r.matchup.b.value, r.matchup.a.strength / 100, r.matchup.b.strength / 100, s.series, s.scoring, s.opportunities, s.sensitivity, s.volatility, s.noise, s.home, s.host, s.rest, c.seed, c.trials, r.simulation.wins, r.simulation.p, ...r.simulation.interval, r.exact.win, r.single, r.draw, r.exact.expectedGames, c.comparison === 'matchup' ? (side === 'left' ? 'main_head_to_head' : 'alternative_rules') : 'separate_benchmark', 1 - r.simulation.p, 1 - r.exact.win, r.simulation.trials - r.simulation.wins, r.evidence.kind, r.evidence.fitGames, r.evidence.scope, r.evidence.weakValidation, r.evidence.outsideFit].join(',');
  });
  return [header.join(','), ...rows].join('\r\n') + '\r\n';
}
