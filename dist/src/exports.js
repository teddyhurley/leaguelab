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
  if (input.version < 9) {
    const changes = [2, 3].includes(input.version) ? 'NHL and Premier League win records are translated to equivalent points rarity. ' : input.version <= 5 ? 'Premier League keeps single-game draws; MLB uses regular-season games. ' : '';
    const rarity = input.version <= 6 ? 'Record rarity uses 20 eligible completed seasons per league. ' : '';
    const allTeams = input.version < 8 ? 'NBA, NHL and NFL use all-team regular-season lookbacks with separate playoff checks. ' : '';
    onMigrate(`Saved experiment upgraded: ${changes}${rarity}${allTeams}MLB now uses completed-season records against other opponents, with every head-to-head meeting removed. All five lookbacks use hindsight. Your records and settings are preserved; earlier odds may change. New experiments start with the NBA–NHL–MLB comparison.`);
  }
  return config;
}
export function exportJSON(result) {
  return JSON.stringify({ ...result, interpretation: 'All five historical fits use completed-season records against other opponents, excluding all head-to-head meetings. They use hindsight, not pregame forecasting. MLB and NFL tied games remain in record denominators but are excluded as binary targets. Playoff transfer and subgroup checks are separate; no postseason adjustment is applied. MLB playoff transfer remains weak; evaluation is exploratory. The NBA/NHL/MLB overview uses neutral venues and standard scoring in the main matchup format. Series and scoring changes are modeled experiments, not measured causal explanations. Intervals quantify Monte Carlo error, not real-world predictive uncertainty.' }, null, 2);
}
export function exportCSV(result) {
  const header = ['model_version', 'scenario', 'sport', 'record_sport_a', 'record_sport_b', 'comparison_mode', 'benchmark_rank', 'focal_team', 'reference_record_a', 'reference_record_unit_a', 'reference_record_b', 'reference_record_unit_b', 'matching', 'basis', 'season_games', 'record_unit', 'focal_record_pace', 'opponent_record_pace', 'focal_strength_rank', 'opponent_strength_rank', 'series', 'scoring_multiplier', 'opportunity_multiplier', 'sensitivity_multiplier', 'volatility', 'noise_multiplier', 'home_edge', 'home_seed', 'rest_edge', 'seed', 'trials', 'focal_team_trial_wins', 'simulation_probability', 'ci_low', 'ci_high', 'exact_probability', 'game_one_advancement', 'game_one_regulation_tie', 'expected_games', 'result_role', 'opponent_simulation_probability', 'opponent_exact_probability', 'opponent_trial_wins', 'evidence_kind', 'fit_games', 'fit_scope', 'weak_validation', 'outside_fitted_gap', 'exact_draw_probability', 'focal_loss_probability', 'simulation_draws', 'simulation_draw_probability', 'outcome_rule', 'playoff_validation_weak', 'outside_team_a_strength', 'outside_team_b_strength', 'outside_fit_support', 'retrospective'];
  const rows = ['left', 'right'].map(side => {
    const s = result.config[side], r = result[side], c = result.config;
    return [result.modelVersion, side, s.sport, c.recordSportA, c.recordSportB, c.comparison, c.opponentRank, r.subject, c.recordA, HISTORY[c.recordSportA].recordUnit, c.recordB, HISTORY[c.recordSportB].recordUnit, c.matching, c.basis, r.matchup.a.games, r.matchup.a.unit, r.matchup.a.value, r.matchup.b.value, r.matchup.a.strength / 100, r.matchup.b.strength / 100, s.series, s.scoring, s.opportunities, s.sensitivity, s.volatility, s.noise, s.home, s.host, s.rest, c.seed, c.trials, r.simulation.wins, r.simulation.p, ...r.simulation.interval, r.outcome.win, r.single, r.draw, r.exact.expectedGames, c.comparison === 'matchup' ? (side === 'left' ? 'main_head_to_head' : 'alternative_rules') : 'separate_benchmark', r.threeWay ? r.simulation.pLoss : 1 - r.simulation.p, r.outcome.loss, r.threeWay ? r.simulation.losses : r.simulation.trials - r.simulation.wins, r.evidence.kind, r.evidence.fitGames, r.evidence.scope, r.evidence.weakValidation, r.evidence.outsideGap, r.outcome.draw, r.outcome.loss, r.simulation.draws || 0, r.simulation.pDraw || 0, r.threeWay ? '90_minutes_draw_allowed' : 'winner_with_fair_deciders', r.evidence.playoffWeak, ...r.evidence.outsideTeam, r.evidence.outsideFit, r.evidence.retrospective].join(',');
  });
  return [header.join(','), ...rows].join('\r\n') + '\r\n';
}
