/** Historical rank inputs, fitted five-sport baselines, and illustrative event mechanics. */
import { HISTORY } from './history-data.js';
import { recordFromLegacyWins, rateAtRank } from './history.js';
export const MODEL_VERSION = '8.0.0';
export const SPORTS = {
  nba: { name: 'NBA', sport: 'Basketball', unit: 'points', opportunity: 'possessions', n: 100, p: HISTORY.nba.meanScore / (100 * 2.28), rewards: [[1, .06], [2, .60], [3, .34]], color: '#c8542c', format: 7, note: 'Many possessions. Repeated chances for skill to show up.' },
  nhl: { name: 'NHL', sport: 'Hockey', unit: 'goals', opportunity: 'shots', n: 31, p: HISTORY.nhl.meanScore / 31, rewards: [[1, 1]], color: '#397c92', format: 7, note: 'Few goals. A single bounce can change the whole game.' },
  mlb: { name: 'MLB', sport: 'Baseball', unit: 'runs', opportunity: 'batting opportunities', n: 38, p: HISTORY.mlb.meanScore / (38 * 1.425), rewards: [[1, .70], [2, .20], [3, .075], [4, .025]], color: '#778754', format: 7, note: 'Discrete chances and clustered runs leave room for surprise.' },
  nfl: { name: 'NFL', sport: 'Football', unit: 'points', opportunity: 'drives', n: 11, p: HISTORY.nfl.meanScore / (11 * 5.42), rewards: [[3, .40], [7, .58], [8, .02]], color: '#8763a1', format: 1, note: 'A handful of high-value drives. One game to decide it.' },
  soccer: { name: 'Premier League', sport: 'Soccer', unit: 'goals', opportunity: 'chances', n: 12, p: HISTORY.soccer.meanScore / 12, rewards: [[1, 1]], color: '#b99032', format: 1, note: 'Sparse scoring makes the margins especially fine.' }
};
export const scenario = (sport) => ({ sport, series: SPORTS[sport].format, scoring: 1, opportunities: 1, sensitivity: 1, volatility: 0, noise: 1, home: 0, host: 'a', rest: 0 });
export const defaultConfig = () => ({ version: 9, recordSportA: 'nba', recordSportB: 'nba', recordA: rateAtRank('nba', .75) * HISTORY.nba.maxRecord, recordB: rateAtRank('nba', .25) * HISTORY.nba.maxRecord, comparison: 'matchup', opponentRank: .5, matching: 'rarity', basis: 'history', trials: 10000, seed: 42, left: { ...scenario('nba'), series: 1 }, right: { ...scenario('nba'), series: 1 } });
/** An untouched experiment follows the starting rules; a customized one is preserved. */
export function updateStartingRules(config, next) {
  const linked = config.comparison === 'matchup' && Object.keys(config.left).every(key => config.left[key] === config.right[key]);
  return { ...config, left: { ...next }, right: linked ? { ...next } : config.right };
}
export const SERIES = [1, 3, 5, 7];

function number(value, min, max, name, integer = false) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) throw new Error(`Invalid ${name}.`);
  return value;
}
export function validateScenario(s) {
  if (!s || !Object.hasOwn(SPORTS, s.sport)) throw new Error('Choose a supported sport.');
  if (!SERIES.includes(s.series)) throw new Error('Series length must be 1, 3, 5, or 7.');
  if (!['a', 'b'].includes(s.host)) throw new Error('Invalid home seed.');
  return { sport: s.sport, series: s.series, host: s.host,
    scoring: number(s.scoring, .5, 3, 'scoring multiplier'), opportunities: number(s.opportunities, .5, 2, 'opportunities'),
    sensitivity: number(s.sensitivity, .25, 2, 'skill sensitivity'), volatility: number(s.volatility, 0, 1, 'event volatility'),
    noise: number(s.noise, 0, 2, 'game-day variance'), home: number(s.home, 0, .3, 'home advantage'), rest: number(s.rest, -.2, .2, 'rest edge') };
}
export function validateConfig(input) {
  // v2/v3 used wins for every league. Upgrade to explicit sport-dependent records.
  const c = input?.version === 2 ? { ...input, version: 3, recordSportA: input.recordSport, recordSportB: input.recordSport, comparison: 'matchup', opponentRank: .5 } : input;
  if (!c || ![3, 4, 5, 6, 7, 8, 9].includes(c.version)) throw new Error('This experiment uses an unsupported strength model. Reset the lab to use league-specific records.');
  if (!Object.hasOwn(SPORTS, c.recordSportA) || !Object.hasOwn(SPORTS, c.recordSportB)) throw new Error('Choose a supported league for each team.');
  const legacy = c.version === 3, matching = legacy && c.matching === 'winRate' ? 'recordRate' : c.matching;
  if (!['rarity', 'recordRate'].includes(matching) || !['history', 'mechanics'].includes(c.basis) || !['benchmark', 'matchup'].includes(c.comparison)) throw new Error('Invalid comparison method.');
  const readRecord = team => {
    const sport = c['recordSport' + team], h = HISTORY[sport];
    const value = number(c[(legacy ? 'wins' : 'record') + team], 0, legacy ? h.seasonGames : h.maxRecord, `Team ${team} ${legacy ? 'wins' : h.recordUnit}`);
    return legacy ? recordFromLegacyWins(sport, value) : value;
  };
  const a = readRecord('A'), b = readRecord('B');
  if (![.25, .5, .75, .9].includes(c.opponentRank)) throw new Error('Choose a supported opponent benchmark.');
  if (![1000, 10000, 50000, 100000].includes(c.trials)) throw new Error('Invalid simulation count.');
  const left = validateScenario(c.left), right = validateScenario(c.right);
  if (c.comparison === 'benchmark' && (left.sport !== c.recordSportA || right.sport !== c.recordSportB)) throw new Error('Each team must play in its selected league.');
  return { version: 9, recordSportA: c.recordSportA, recordSportB: c.recordSportB, recordA: a, recordB: b,
    comparison: c.comparison, opponentRank: c.opponentRank, matching: c.comparison === 'benchmark' ? 'rarity' : matching, basis: c.basis,
    trials: c.trials, seed: number(c.seed, 0, 4294967295, 'seed', true), left, right };
}
