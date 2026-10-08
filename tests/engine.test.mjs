import test from 'node:test';
import assert from 'node:assert/strict';
import { SPORTS, defaultConfig, scenario, validateConfig } from '../dist/src/presets.js';
import { rng, scorePMF, eventRewards, gameDistribution, seriesExact, gameProbabilities, simulateSeries, runExperiment, evaluate, effectiveMechanics, wilson } from '../dist/src/engine.js';

const close = (a, b, tolerance = 1e-9) => assert.ok(Math.abs(a - b) < tolerance, `${a} is not within ${tolerance} of ${b}`);
const sum = xs => xs.reduce((a, b) => a + b, 0);
test('compound opportunity scores normalize and match analytic mean and variance', () => {
  const n = 20, p = .3, rewards = [[1, .2], [2, .6], [3, .2]], pmf = scorePMF(n, p, rewards);
  const meanReward = sum(rewards.map(([r, w]) => r * w)), squareReward = sum(rewards.map(([r, w]) => r * r * w));
  const mean = sum(pmf.map((v, i) => i * v)), variance = sum(pmf.map((v, i) => (i - mean) ** 2 * v));
  close(sum(pmf), 1); close(mean, n * p * meanReward); close(variance, n * (p * squareReward - (p * meanReward) ** 2));
});
test('reward volatility preserves the mean and increases variance', () => {
  for (const sport of Object.values(SPORTS)) {
    const moments = v => { const r = eventRewards(sport.rewards, v); return [sum(r.map(([x, w]) => x * w)), sum(r.map(([x, w]) => x * x * w))]; };
    const low = moments(0), high = moments(1); close(low[0], high[0]); assert.ok(high[1] > low[1]);
  }
});
test('all neutral equal-strength sports have 50/50 advancement and normalized margins', () => {
  for (const sport of Object.keys(SPORTS)) { const g = gameDistribution(scenario(sport), 65, 65); close(g.p, .5); close(sum(g.margin), 1); close(g.scoreA, g.scoreB); assert.ok(g.draw >= 0 && g.draw <= 1); }
});
test('swapping strength and context complements advancement', () => {
  const s = { ...scenario('nhl'), home: .13, rest: .06 };
  const a = gameDistribution(s, 70, 55, 1), b = gameDistribution({ ...s, rest: -.06 }, 55, 70, -1);
  close(a.p + b.p, 1); close(a.draw, b.draw); close(a.scoreA, b.scoreB);
});
test('multiplying every scoring reward leaves win probabilities unchanged', () => {
  const rewards = [[1, .3], [2, .7]], a = scorePMF(8, .4, rewards), b = scorePMF(8, .3, rewards);
  const scaledA = scorePMF(8, .4, rewards.map(([r, p]) => [r * 3, p])), scaledB = scorePMF(8, .3, rewards.map(([r, p]) => [r * 3, p]));
  const win = (x, y) => { let p = 0; x.forEach((v, i) => y.forEach((w, j) => { p += v * w * (i > j ? 1 : i === j ? .5 : 0); })); return p; };
  close(win(a, b), win(scaledA, scaledB));
});
test('best-of-seven exact calculation matches an independent binomial tail', () => {
  for (const p of [.1, .5, .7, .95]) { const exact = seriesExact(new Array(7).fill(p)); const expected = 35 * p ** 4 * (1 - p) ** 3 + 21 * p ** 5 * (1 - p) ** 2 + 7 * p ** 6 * (1 - p) + p ** 7; close(exact.win, expected); close(sum(exact.lengths), 1); assert.ok(exact.expectedGames >= 4 && exact.expectedGames <= 7); }
});
test('deterministic series terminate at clinching', () => {
  for (const p of [0, 1]) { const r = simulateSeries(new Array(7).fill(p), 1000, 42); assert.equal(r.wins, p * 1000); assert.equal(r.expectedGames, 4); assert.equal(r.lengths[4], 1000); close(seriesExact(new Array(7).fill(p)).expectedGames, 4); }
});
test('home schedules and seed swap are explicit and symmetric', () => {
  const games = { 0: { p: .5 }, 1: { p: .6 }, '-1': { p: .4 } };
  const s = { ...scenario('nba'), home: .1 };
  assert.deepEqual(gameProbabilities(s, games), [.6, .6, .4, .4, .6, .4, .6]);
  close(seriesExact(gameProbabilities(s, games)).win + seriesExact(gameProbabilities({ ...s, host: 'b' }, games)).win, 1);
});
test('Monte Carlo is deterministic and agrees with exact model within five standard errors', () => {
  const ps = [.68, .68, .57, .57, .68, .57, .68], n = 100000, exact = seriesExact(ps);
  const a = simulateSeries(ps, n, 123), b = simulateSeries(ps, n, 123);
  assert.deepEqual(a, b); close(a.p, exact.win, 5 * Math.sqrt(exact.win * (1 - exact.win) / n));
  close(a.expectedGames, exact.expectedGames, .02); assert.equal(sum(a.lengths), n); assert.equal(a.samples.length, 100);
  assert.notEqual(a.wins, simulateSeries(ps, n, 124).wins);
});
test('Wilson intervals are valid at boundary counts and narrow with larger samples', () => {
  for (const wins of [0, 50, 100]) { const [lo, hi] = wilson(wins, 100); assert.ok(lo >= -1e-15 && hi <= 1 + 1e-15 && lo <= hi); }
  assert.ok(wilson(6000, 10000)[1] - wilson(6000, 10000)[0] < wilson(60, 100)[1] - wilson(60, 100)[0]);
});
test('counterfactuals distinguish opportunities, conversion rate, variance and format', () => {
  const s = scenario('nhl'), base = evaluate(s, 70, 55), easy = evaluate({ ...s, scoring: 3 }, 70, 55), one = evaluate({ ...s, series: 1 }, 70, 55), many = evaluate({ ...s, opportunities: 2 }, 70, 55);
  assert.ok(easy.exact.win > base.exact.win); assert.ok(many.exact.win > base.exact.win); assert.ok(base.exact.win > one.exact.win);
  assert.equal(effectiveMechanics({ ...scenario('nba'), scoring: 3 }).p, .95);
});
test('seeded RNG covers [0, 1), including a valid zero seed', () => { for (const seed of [0, 42, 4294967295]) { const r = rng(seed); for (let i = 0; i < 100; i++) { const v = r(); assert.ok(v >= 0 && v < 1); } } });
test('configuration validation rejects malformed and excessive shared input', () => {
  assert.deepEqual(validateConfig(defaultConfig()), defaultConfig());
  for (const patch of [{ trials: 1000000000 }, { seed: -1 }, { recordA: NaN }, { recordB: 83 }, { version: 1 }, { recordSportA: "__proto__" }, { recordA: 83 }, { matching: "raw" }, { seed: 1.2 }]) assert.throws(() => validateConfig({ ...defaultConfig(), ...patch }));
  for (const patch of [{ sport: '__proto__' }, { opportunities: Infinity }, { series: 8 }, { volatility: -1 }, { home: 100 }]) assert.throws(() => validateConfig({ ...defaultConfig(), left: { ...scenario('nba'), ...patch } }));
});
test('full experiment keeps a reproducible snapshot and the ordered bridge reconciles', () => {
  const c = { ...defaultConfig(), trials: 1000 }, r = runExperiment(c);
  assert.deepEqual(r.config, c); assert.equal(r.leagues.length, 5); close(r.bridge[0], r.left.exact.win); close(r.bridge.at(-1), r.right.exact.win);
  close(sum(r.bridge.slice(1).map((p, i) => p - r.bridge[i])), r.right.exact.win - r.left.exact.win);
  c.left.scoring = 2; assert.equal(r.config.left.scoring, 1);
});
