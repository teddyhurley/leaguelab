import { SPORTS, SERIES, MODEL_VERSION, scenario, validateConfig } from './presets.js';
import { HISTORY } from './history-data.js';
import { comparisonMatchup, rateAtRank } from './history.js';

export const logistic = x => 1 / (1 + Math.exp(-x));
export const logit = p => Math.log(p / (1 - p));
export function rng(seed) {
  let state = seed >>> 0;
  return () => { let t = state += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

// A finite, symmetric game-day form mixture. Weights sum to 1, variance = 1.
// Discrete on purpose: no hidden Gaussian integration approximation.
const FORM = [[-2, .0625], [-1, .25], [0, .375], [1, .25], [2, .0625]];
export function eventRewards(base, volatility) {
  const rewards = new Map();
  const add = (r, p) => rewards.set(r, (rewards.get(r) || 0) + p);
  for (const [r, p] of base) { add(0, p * volatility / 2); add(r, p * (1 - volatility)); add(2 * r, p * volatility / 2); }
  return [...rewards].filter(([, p]) => p > 0);
}
export function scorePMF(n, p, rewards) {
  const max = Math.max(...rewards.map(([r]) => r));
  let pmf = new Float64Array([1]);
  for (let i = 0; i < n; i++) {
    const next = new Float64Array((i + 1) * max + 1);
    for (let score = 0; score < pmf.length; score++) {
      const mass = pmf[score];
      if (mass < 1e-18) continue;
      next[score] += mass * (1 - p);
      for (const [reward, weight] of rewards) next[score + reward] += mass * p * weight;
    }
    pmf = next;
  }
  return pmf;
}
export function effectiveMechanics(s) {
  const sport = SPORTS[s.sport];
  return { n: Math.round(sport.n * s.opportunities), p: Math.min(.95, sport.p * s.scoring), rewards: eventRewards(sport.rewards, s.volatility), sensitivity: .12 * s.sensitivity, noise: .12 * s.noise, capped: sport.p * s.scoring > .95 };
}
export function gameDistribution(s, strengthA, strengthB, venue = 0, baseEdge = null, outcomeWeights = null) {
  const m = effectiveMechanics(s);
  const delta = logit(strengthA / 100) - logit(strengthB / 100);
  const max = m.n * Math.max(...m.rewards.map(([r]) => r));
  const margin = new Float64Array(max * 2 + 1);
  const shocks = m.noise === 0 ? [[0, 1]] : FORM;
  let scoreA = 0, scoreB = 0;
  const scoreMoments = [[0, 0], [0, 0], [0, 0]]; // loss, draw, win
  for (const [form, weight] of shocks) {
    const edge = (baseEdge === null ? .12 * delta : baseEdge) * s.sensitivity + venue * s.home + s.rest + form * m.noise;
    const pa = logistic(logit(m.p) + edge / 2), pb = logistic(logit(m.p) - edge / 2);
    const a = scorePMF(m.n, pa, m.rewards), b = scorePMF(m.n, pb, m.rewards);
    for (let i = 0; i < a.length; i++) {
      scoreA += weight * i * a[i];
      scoreB += weight * i * b[i];
      if (a[i] < 1e-15) continue;
      for (let j = 0; j < b.length; j++) {
        if (b[j] > 1e-15) {
          const mass = weight * a[i] * b[j];
          margin[max + i - j] += mass;
          if (outcomeWeights) {
            const category = i > j ? 2 : i < j ? 0 : 1;
            scoreMoments[category][0] += mass * i;
            scoreMoments[category][1] += mass * j;
          }
        }
      }
    }
  }
  if (outcomeWeights) {
    scoreA = 0; scoreB = 0;
    for (let i = 0; i < margin.length; i++) margin[i] *= outcomeWeights[i > max ? 2 : i < max ? 0 : 1];
    for (let i = 0; i < 3; i++) { scoreA += scoreMoments[i][0] * outcomeWeights[i]; scoreB += scoreMoments[i][1] * outcomeWeights[i]; }
  }
  let win = 0, loss = 0;
  for (let i = 0; i < margin.length; i++) { if (i > max) win += margin[i]; else if (i < max) loss += margin[i]; }
  const draw = margin[max];
  const total = win + loss + draw;
  for (let i = 0; i < margin.length; i++) margin[i] /= total;
  return { p: (win + draw / 2) / total, win: win / total, loss: loss / total, draw: draw / total, scoreA: scoreA / total, scoreB: scoreB / total, margin, offset: max, mechanics: m };
}

// Explicit best-of schedules. +1 means the designated top seed hosts.
export const SCHEDULES = { 1: [1], 3: [1, -1, 1], 5: [1, 1, -1, -1, 1], 7: [1, 1, -1, -1, 1, -1, 1] };
export function gameProbabilities(s, games) { return SCHEDULES[s.series].map(v => games[s.home === 0 ? 0 : v * (s.host === 'a' ? 1 : -1)].p); }
export function seriesExact(probabilities) {
  const needed = (probabilities.length + 1) / 2;
  const states = Array.from({ length: needed + 1 }, () => new Float64Array(needed + 1));
  states[0][0] = 1;
  let win = 0, expectedGames = 0;
  const lengths = new Float64Array(probabilities.length + 1);
  for (let played = 0; played < probabilities.length; played++) {
    const p = probabilities[played];
    for (let a = 0; a < needed; a++) {
      const b = played - a;
      if (b < 0 || b >= needed) continue;
      const mass = states[a][b];
      if (a + 1 === needed) { win += mass * p; lengths[played + 1] += mass * p; }
      else states[a + 1][b] += mass * p;
      if (b + 1 === needed) lengths[played + 1] += mass * (1 - p);
      else states[a][b + 1] += mass * (1 - p);
    }
  }
  for (let i = 0; i < lengths.length; i++) expectedGames += lengths[i] * i;
  return { win, expectedGames, lengths: Array.from(lengths) };
}
export function wilson(wins, n) {
  const p = wins / n, z = 1.95996398454, d = 1 + z * z / n;
  const center = (p + z * z / (2 * n)) / d, half = z / d * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return [center - half, center + half];
}
function summarizeMargin(game) {
  let cdf = 0, lo = -game.offset, hi = game.offset, found = false;
  for (let i = 0; i < game.margin.length; i++) { cdf += game.margin[i]; if (!found && cdf >= .001) { lo = i - game.offset; found = true; } if (cdf >= .999) { hi = i - game.offset; break; } }
  const radius = Math.max(Math.abs(lo), Math.abs(hi), 3);
  const proposedWidth = Math.max(1, Math.ceil((radius * 2 + 1) / 45));
  const width = proposedWidth % 2 ? proposedWidth : proposedWidth + 1;
  const extent = Math.ceil(radius / width) * width;
  const bins = [];
  for (let x = -extent; x <= extent; x += width) {
    let probability = 0;
    for (let j = x - (width - 1) / 2; j <= x + (width - 1) / 2; j++) probability += game.margin[j + game.offset] || 0;
    bins.push({ x, probability });
  }
  return { bins, radius: extent + (width - 1) / 2, width };
}
const cache = new Map();
const edgeCache = new Map();
const soccerWeightsCache = new Map();
export function historicalStrength(sport, value) {
  const fit = HISTORY[sport].fit;
  if (fit.strengthScale === 'smoothedWinLogit') {
    return logit((rateAtRank(sport, value / 100) * fit.referenceGames + fit.priorGames / 2) / (fit.referenceGames + fit.priorGames));
  }
  return logit(value / 100);
}
export function historicalStrengthGap(sport, a, b) { return historicalStrength(sport, a) - historicalStrength(sport, b); }
export function historicalSoccerOutcome(a, b) {
  const fit = HISTORY.soccer.fit, half = fit.slope * historicalStrengthGap('soccer', a, b) / 2;
  const peak = Math.max(half, -half, fit.drawLogWeight);
  const win = Math.exp(half - peak), loss = Math.exp(-half - peak), draw = Math.exp(fit.drawLogWeight - peak), total = win + loss + draw;
  return { win: win / total, loss: loss / total, draw: draw / total };
}
// Invert the neutral baseline event model once per matchup. Counterfactuals
// keep this event edge fixed, so changing scoring does not recalibrate it away.
export function calibratedEdge(sport, a, b) {
  const delta = historicalStrengthGap(sport, a, b), fit = HISTORY[sport].fit;
  if (!fit) throw new Error(`Missing historical game fit for ${sport}.`);
  const key = JSON.stringify([sport, delta]);
  if (edgeCache.has(key)) return edgeCache.get(key);
  const soccer = sport === 'soccer' ? historicalSoccerOutcome(a, b) : null;
  const target = soccer ? soccer.win / (soccer.win + soccer.loss) : logistic(fit.slope * delta), base = SPORTS[sport];
  let lo = -8, hi = 8;
  for (let step = 0; step < 25; step++) {
    const edge = (lo + hi) / 2;
    let chance = 0, ties = 0;
    for (const [form, weight] of FORM) {
      const pa = logistic(logit(base.p) + (edge + .12 * form) / 2);
      const pb = logistic(logit(base.p) - (edge + .12 * form) / 2);
      const aa = scorePMF(base.n, pa, base.rewards), bb = scorePMF(base.n, pb, base.rewards);
      let below = 0;
      for (let i = 0; i < aa.length; i++) { chance += weight * aa[i] * (below + .5 * (bb[i] || 0)); ties += weight * aa[i] * (bb[i] || 0); below += bb[i] || 0; }
    }
    // Match the decisive-game ratio so draw correction cannot retain an
    // unintended directional edge when a what-if changes skill sensitivity.
    if (soccer) chance = (chance - ties / 2) / (1 - ties);
    if (chance < target) lo = edge; else hi = edge;
  }
  const edge = (lo + hi) / 2;
  if (edgeCache.size >= 40) edgeCache.delete(edgeCache.keys().next().value);
  edgeCache.set(key, edge);
  return edge;
}
function gamesFor(s, a, b, basis) {
  const { series, host, ...mechanics } = s;
  const key = JSON.stringify([mechanics, a, b, basis]);
  if (cache.has(key)) return cache.get(key);
  const edge = basis === 'history' ? calibratedEdge(s.sport, a, b) : null;
  let weights = null;
  if (basis === 'history' && s.sport === 'soccer') {
    const weightKey = JSON.stringify([a, b]);
    weights = soccerWeightsCache.get(weightKey);
    if (!weights) {
      const raw = gameDistribution(scenario('soccer'), a, b, 0, edge), target = historicalSoccerOutcome(a, b);
      weights = [target.loss / raw.loss, target.draw / raw.draw, target.win / raw.win];
      if (soccerWeightsCache.size >= 40) soccerWeightsCache.delete(soccerWeightsCache.keys().next().value);
      soccerWeightsCache.set(weightKey, weights);
    }
  }
  // Keep the historical outcome correction fixed as mechanics change.
  const neutral = gameDistribution(s, a, b, 0, edge, weights);
  const games = { 0: neutral };
  if (s.home) { games[1] = gameDistribution(s, a, b, 1, edge, weights); games[-1] = gameDistribution(s, a, b, -1, edge, weights); }
  if (cache.size >= 24) cache.delete(cache.keys().next().value);
  cache.set(key, games);
  return games;
}
export function evaluate(s, a, b, basis = 'mechanics') {
  const games = gamesFor(s, a, b, basis), probabilities = gameProbabilities(s, games);
  const first = games[s.home === 0 ? 0 : s.host === 'a' ? 1 : -1];
  const regulation = { win: first.win, draw: first.draw, loss: first.loss };
  const threeWay = s.sport === 'soccer' && s.series === 1;
  const exact = seriesExact(probabilities);
  return { exact, probabilities, single: first.p, draw: first.draw, regulation, threeWay,
    outcome: threeWay ? regulation : { win: exact.win, draw: 0, loss: 1 - exact.win },
    scoreA: first.scoreA, scoreB: first.scoreB, distribution: summarizeMargin(first), mechanics: first.mechanics,
    curve: SERIES.map(series => ({ series, ...seriesExact(gameProbabilities({ ...s, series }, games)) })) };
}
export function simulateSeries(probabilities, trials, seed) {
  const random = rng(seed), needed = (probabilities.length + 1) / 2;
  let wins = 0, totalGames = 0;
  const samples = [], lengths = new Array(probabilities.length + 1).fill(0), convergence = [];
  for (let i = 0; i < trials; i++) {
    let a = 0, b = 0, games = 0;
    while (a < needed && b < needed) { if (random() < probabilities[games]) a++; else b++; games++; }
    const won = a === needed;
    wins += Number(won); totalGames += games; lengths[games]++;
    if (i < 100) samples.push(won);
    if ((i + 1) % (trials / 20) === 0) convergence.push({ n: i + 1, p: wins / (i + 1) });
  }
  return { trials, wins, p: wins / trials, interval: wilson(wins, trials), expectedGames: totalGames / trials, lengths, samples, convergence };
}
export function simulateMatch(outcome, trials, seed) {
  const random = rng(seed), samples = [], convergence = [];
  let wins = 0, draws = 0, losses = 0;
  for (let i = 0; i < trials; i++) {
    const u = random(), category = u < outcome.win ? 'A' : u < outcome.win + outcome.draw ? 'D' : 'B';
    if (category === 'A') wins++; else if (category === 'D') draws++; else losses++;
    if (i < 100) samples.push(category);
    if ((i + 1) % (trials / 20) === 0) convergence.push({ n: i + 1, p: wins / (i + 1) });
  }
  return { trials, wins, draws, losses, p: wins / trials, pDraw: draws / trials, pLoss: losses / trials,
    interval: wilson(wins, trials), intervalDraw: wilson(draws, trials), intervalLoss: wilson(losses, trials),
    expectedGames: 1, lengths: [0, trials], samples, convergence };
}
/** Both sides of one matchup; Team B is the complement of the same trials. */
export function headToHeadOutcome(r) {
  const sim = r.simulation;
  return {
    exact: { a: r.outcome.win, b: r.outcome.loss, draw: r.outcome.draw },
    simulation: { trials: sim.trials, winsA: sim.wins, winsB: r.threeWay ? sim.losses : sim.trials - sim.wins, draws: sim.draws || 0,
      pA: sim.p, pB: r.threeWay ? sim.pLoss : 1 - sim.p, pDraw: sim.pDraw || 0, intervalA: [...sim.interval], intervalB: r.threeWay ? [...sim.intervalLoss] : [1 - sim.interval[1], 1 - sim.interval[0]],
      winners: r.threeWay ? sim.samples : sim.samples.map(won => won ? 'A' : 'B') }
  };
}
/** Group charts by the inputs to one regulation game, not just the league name.
 * Series length, trial count and seed cannot change a game-one score chart.
 * Both UI pending states and completed results use this same grouping rule.
 */
export function scorePreviewGroups(config) {
  const groups = new Map();
  const candidates = [
    { role: 'teamA', rules: { ...scenario(config.recordSportA), series: 1 }, team: 'A' },
    { role: 'teamB', rules: { ...scenario(config.recordSportB), series: 1 }, team: 'B' },
    { role: 'matchup', rules: config.left, team: 'A' },
    { role: 'experiment', rules: config.right, team: 'B' }
  ];
  for (const { role, rules, team } of candidates) {
    const subject = config.comparison === 'benchmark' ? team : 'A';
    const matchup = comparisonMatchup(config, rules.sport, subject), m = effectiveMechanics(rules);
    const venue = (rules.host === 'a' ? 1 : -1) * rules.home;
    const key = JSON.stringify([rules.sport, subject, config.basis, matchup.a.strength, matchup.b.strength,
      m.n, m.p, m.rewards, m.sensitivity, m.noise, venue, rules.rest]);
    if (groups.has(key)) groups.get(key).roles.push(role);
    else groups.set(key, { sport: rules.sport, roles: [role], subject, matchup, rules: { ...rules } });
  }
  return [...groups.values()];
}
export function modelEvidence(s, a, b, basis = 'history') {
  const h = HISTORY[s.sport], defaults = scenario(s.sport);
  const changed = ['scoring', 'opportunities', 'sensitivity', 'volatility', 'noise', 'home', 'rest'].some(key => s[key] !== defaults[key]);
  const counterfactual = basis !== 'history' || changed;
  const weakValidation = h.validation.model.brier >= h.validation.homeOnly.brier;
  const range = h.fit.individualStrengthRange;
  const outsideTeam = [a, b].map(value => { const strength = historicalStrength(s.sport, value); return strength < range[0] - 1e-10 || strength > range[1] + 1e-10; });
  const outsideGap = Math.abs(historicalStrengthGap(s.sport, a, b)) > h.fit.maxAbsStrengthGap + 1e-10;
  const subgroupWarnings = Object.entries(h.validation.subgroups || {}).filter(([, v]) => v.model.brier >= v.homeOnly.brier).map(([group, v]) => ({ group, games: v.model.games }));
  if (h.additionalEvidence?.bothBottomQuartile) {
    const v = h.additionalEvidence.bothBottomQuartile;
    if (v.model.brier >= v.homeOnly.brier) subgroupWarnings.push({ group: 'bothBottomQuartile', games: v.model.games, scope: h.additionalEvidence.scope });
  }
  return { kind: basis !== 'history' ? 'controlled' : changed ? 'counterfactual' : 'historical',
    counterfactual, fitGames: h.fit.games, scope: h.fit.scope, window: h.fit.window,
    weakValidation, playoffWeak: Boolean(h.playoffValidation && h.playoffValidation.model.brier >= Math.min(h.playoffValidation.homeOnly.brier, h.playoffValidation.coinFlip.brier)),
    retrospective: Boolean(h.fit.retrospective), outsideFit: outsideGap || outsideTeam.some(Boolean), outsideGap, outsideTeam, subgroupWarnings,
    playoffGames: h.playoffValidation?.model.games || 0,
    seriesDerived: s.series > 1, scoreModel: 'Mechanistic score distribution; not validated against historical margins',
    label: basis !== 'history' ? 'Controlled mechanics' : changed ? 'What-if from historical fit' : `${h.fit.retrospective ? 'Season-end lookback' : 'Regular-season'} fit${weakValidation ? ' · weak validation' : ''}` };
}
export function runExperiment(input, progress = () => {}) {
  const config = validateConfig(input), { trials, seed } = config;
  const resolve = (s, team = 'A') => {
    const matchup = comparisonMatchup(config, s.sport, team);
    return { ...evaluate(s, matchup.a.strength, matchup.b.strength, config.basis), matchup, subject: config.comparison === 'benchmark' ? team : 'A',
      evidence: modelEvidence(s, matchup.a.strength, matchup.b.strength, config.basis),
      baseline: modelEvidence(s, matchup.a.strength, matchup.b.strength, config.basis).label };
  };
  progress(.05, 'Calculating event distributions');
  const left = resolve(config.left); progress(.25, 'Resolving the comparison');
  const right = resolve(config.right, 'B'); progress(.45, 'Simulating independent series');
  const simulate = (r, s) => r.threeWay ? simulateMatch(r.outcome, trials, s) : simulateSeries(r.probabilities, trials, s);
  left.simulation = simulate(left, seed);
  right.simulation = simulate(right, seed ^ 0x9e3779b9);
  // First swap includes the league-specific record mapping and baseline fit.
  const sportSwap = { ...config.right, series: config.left.series, home: config.left.home, host: config.left.host, rest: config.left.rest };
  const formatSwap = { ...sportSwap, series: config.right.series };
  const bridge = config.comparison === 'benchmark'
    ? [left.outcome.win, resolve(config.left, 'B').outcome.win, resolve(sportSwap, 'B').outcome.win, resolve(formatSwap, 'B').outcome.win, right.outcome.win]
    : [left.outcome.win, resolve(sportSwap).outcome.win, resolve(formatSwap).outcome.win, right.outcome.win];
  progress(.65, 'Comparing all five sports');
  const leagueResults = Object.fromEntries(Object.keys(SPORTS).map((sport, i) => {
    const r = resolve({ ...scenario(sport), series: 1 });
    progress(.65 + (i + 1) * .065, `Comparing ${SPORTS[sport].name}`);
    return [sport, r];
  }));
  const leagues = Object.entries(leagueResults).map(([sport, r]) => ({ sport, single: r.outcome.win, seven: r.curve.find(c => c.series === 7).win, formats: Object.fromEntries(r.curve.map(c => [c.series, c.win])), draw: r.draw, matchup: r.matchup, baseline: r.baseline, evidence: r.evidence }));
  const scorePreviews = scorePreviewGroups(config).map(group => {
    const r = group.roles.includes('matchup') ? left : group.roles.includes('experiment') ? right
      : group.subject === 'B' ? resolve(group.rules, 'B') : leagueResults[group.sport];
    return { ...group, scoreA: r.scoreA, scoreB: r.scoreB, single: r.single, draw: r.draw, distribution: r.distribution };
  });
  progress(1, 'Complete');
  return { modelVersion: MODEL_VERSION, config, left, right, bridge, leagues, scorePreviews, headToHead: config.comparison === 'matchup' ? { scenario: 'left', rules: config.left, ...headToHeadOutcome(left) } : null };
}

/** Standard sport comparison holds records and the selected main format fixed.
 * Custom scoring/context belongs to the detailed starting/experiment stages.
 */
export function coreComparison(result) {
  const series = result.config.left.series;
  return ['nba', 'nhl', 'mlb'].map(sport => {
    const r = result.leagues.find(row => row.sport === sport);
    return { sport, series, winA: r.formats[series], winB: 1 - r.formats[series], matchup: r.matchup, evidence: r.evidence };
  });
}
