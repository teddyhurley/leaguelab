import { HISTORY } from './history-data.js';

// Rates are shares of the maximum available: wins/games or points/(2 or 3 * games).
function rankOnKnots(points, rate) {
  if (rate <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    if (rate <= points[i][0]) {
      const [x0, q0] = points[i - 1], [x1, q1] = points[i];
      return q0 + (q1 - q0) * (rate - x0) / (x1 - x0);
    }
  }
  return points.at(-1)[1];
}
export function recordRank(sport, rate) { return rankOnKnots(HISTORY[sport].knots, rate); }
export function rateAtRank(sport, rank) {
  const points = HISTORY[sport].knots;
  if (rank <= points[0][1]) return points[0][0];
  for (let i = 1; i < points.length; i++) {
    if (rank <= points[i][1]) {
      const [x0, q0] = points[i - 1], [x1, q1] = points[i];
      return x0 + (x1 - x0) * (rank - q0) / (q1 - q0);
    }
  }
  return points.at(-1)[0];
}
export function recordContext(sport, rate) {
  const h = HISTORY[sport], points = h.knots;
  const atLeast = points.reduce((n, [x, , count]) => n + (x >= rate - 1e-10 ? count : 0), 0);
  return { sport, games: h.seasonGames, value: rate * h.maxRecord, unit: h.recordUnit, max: h.maxRecord, rate, rank: recordRank(sport, rate),
    atLeast, sampleSize: h.sampleSize, tail: atLeast / h.sampleSize,
    outside: rate < points[0][0] - 1e-10 || rate > points.at(-1)[0] + 1e-10 };
}
// Older links contain wins, which cannot be interpreted as literal points.
// Translate their empirical rarity; this is not an inferred W/D/OTL record.
export function recordFromLegacyWins(sport, wins) {
  const h = HISTORY[sport];
  if (!h.legacyWinKnots) return wins;
  if (wins === 0 || wins === h.seasonGames) return wins / h.seasonGames * h.maxRecord;
  return rateAtRank(sport, rankOnKnots(h.legacyWinKnots, wins / h.seasonGames)) * h.maxRecord;
}
export function teamFor(config, team, sport) {
  const sourceSport = config['recordSport' + team], ref = HISTORY[sourceSport];
  const rate = config['record' + team] / ref.maxRecord;
  const rank = recordRank(sourceSport, rate);
  const mappedRate = sport === sourceSport || config.matching === 'recordRate' ? rate : rateAtRank(sport, rank);
  const context = recordContext(sport, mappedRate);
  return { ...context, strength: 100 * (config.matching === 'rarity' ? rank : context.rank),
    mapped: sport !== sourceSport, sourceSport, referenceOutside: recordContext(sourceSport, rate).outside };
}
export function matchupFor(config, sport) {
  return { a: teamFor(config, 'A', sport), b: teamFor(config, 'B', sport) };
}
export function comparisonMatchup(config, sport, team = 'A') {
  if (config.comparison === 'matchup') return matchupFor(config, sport);
  return { a: teamFor({ ...config, matching: 'rarity' }, team, sport), b: { ...recordContext(sport, rateAtRank(sport, config.opponentRank)),
    strength: 100 * config.opponentRank, mapped: false, referenceOutside: false, benchmark: true } };
}
export function changeRecordSport(config, team, sport) {
  const key = 'recordSport' + team;
  if (sport === config[key]) return config;
  const mapped = teamFor(config, team, sport);
  return { ...config, [key]: sport, ['record' + team]: mapped.value };
}
