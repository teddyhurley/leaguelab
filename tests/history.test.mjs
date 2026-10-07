import test from 'node:test';
import assert from 'node:assert/strict';
import { HISTORY } from '../dist/src/history-data.js';
import { recordContext, recordRank, rateAtRank, matchupFor, comparisonMatchup, changeRecordSport } from '../dist/src/history.js';
import { defaultConfig, scenario, validateConfig } from '../dist/src/presets.js';
import { evaluate, logistic, logit, runExperiment } from '../dist/src/engine.js';
const close = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);

test('empirical record counts reconcile and distinguish NBA and NHL tails', () => {
  assert.deepEqual(Object.values(HISTORY).map(h => h.sampleSize), [240, 250, 270, 318, 200]);
  for (const h of Object.values(HISTORY)) assert.equal(h.knots.reduce((s, p) => s + p[2], 0), h.sampleSize);
  assert.equal(recordContext('nba', 70 / 82).atLeast, 1);
  assert.equal(recordContext('nba', 60 / 82).atLeast, 11);
  assert.equal(recordContext('nhl', 135 / 164).atLeast, 1);
  assert.equal(recordContext('nhl', 140 / 168).atLeast, 0);
  assert.equal(recordContext('soccer', 100 / 114).atLeast, 1);
});
test('each sport supplies its own slider bounds and bounded finite strength at extremes', () => {
  for (const [sport, games] of Object.entries({ nba: 82, nhl: 84, mlb: 162, nfl: 17, soccer: 38 })) {
    const c = changeRecordSport({ ...defaultConfig(), comparison: 'matchup' }, 'A', sport);
    assert.equal(HISTORY[sport].seasonGames, games);
    assert.equal(validateConfig(c).recordSportA, sport);
    for (const wins of [0, HISTORY[sport].maxRecord]) {
      const m = matchupFor({ ...c, recordA: wins }, sport);
      assert.ok(Number.isFinite(logit(m.a.strength / 100)));
      assert.equal(m.a.value, wins);
    }
    assert.throws(() => validateConfig({ ...c, recordA: HISTORY[sport].maxRecord + 1 }));
  }
});
test('rarity matching and record-percentage matching have different, explicit invariants', () => {
  const c = { ...defaultConfig(), comparison: 'matchup', recordA: 60, recordB: 45, recordSportB: 'nba' }, nba = matchupFor(c, 'nba'), nhl = matchupFor(c, 'nhl');
  close(nba.a.strength, nhl.a.strength);
  assert.notEqual(nhl.a.value / 168, nba.a.value / 82);
  const rate = matchupFor({ ...c, matching: 'recordRate' }, 'nhl');
  close(rate.a.rate, nba.a.rate);
  assert.notEqual(rate.a.strength, nba.a.strength);
  let roundtrip = c;
  for (const sport of ['nfl', 'mlb', 'soccer', 'nhl', 'nba']) roundtrip = changeRecordSport(roundtrip, 'A', sport);
  close(roundtrip.recordA, c.recordA); close(roundtrip.recordB, c.recordB);
  for (const sport of Object.keys(HISTORY)) {
    const h = HISTORY[sport];
    for (let i = 1; i < h.knots.length; i++) {
      const x = (h.knots[i][0] + h.knots[i - 1][0]) / 2;
      close(rateAtRank(sport, recordRank(sport, x)), x);
    }
  }
});
test('unseen records cap the proxy but preserve the selected record and zero observed count', () => {
  const extreme = recordContext('nhl', 140 / 168), perfect = recordContext('nhl', 1);
  assert.equal(extreme.atLeast, 0); assert.equal(extreme.outside, true);
  close(extreme.rank, perfect.rank);
  assert.equal(perfect.value, 168);
});
test('fitted neutral game probabilities reproduce the regularized outcome model', () => {
  for (const sport of ['nba', 'nhl']) {
    for (const [a, b] of [[75, 55], [50, 50], [30, 80], [99, 20]]) {
      const target = logistic(HISTORY[sport].fit.slope * (logit(a / 100) - logit(b / 100)));
      close(evaluate(scenario(sport), a, b, 'history').single, target, 1e-6);
    }
    const base = evaluate(scenario(sport), 85, 55, 'history');
    const changed = evaluate({ ...scenario(sport), opportunities: 2 }, 85, 55, 'history');
    assert.ok(changed.single > base.single);
  }
});
test('historical rates retain proper denominators and the validation cutoff is explicit', () => {
  assert.equal(HISTORY.nba.playoffs.games.n, 778);
  assert.equal(HISTORY.nhl.playoffs.games.n, 833);
  assert.equal(HISTORY.nba.playoffs.series.n, 141);
  assert.equal(HISTORY.nhl.playoffs.series.n, 143);
  for (const sport of ['nba', 'nhl']) {
    const v = HISTORY[sport].validation;
    assert.equal(v.trainingGames + v.model.games, HISTORY[sport].fit.games);
    assert.equal(v.test, '2023–2025 postseasons');
    assert.ok(v.model.brier < v.homeOnly.brier);
  }
});
test('50 NBA wins and 10 NFL wins use separate scales and separate opponents', () => {
  const c = { ...defaultConfig(), comparison: 'benchmark', right: scenario('nfl') };
  const left = comparisonMatchup(c, 'nba', 'A'), right = comparisonMatchup(c, 'nfl', 'B');
  close(left.a.value, 50); close(right.a.value, 10);
  assert.equal(left.a.games, 82); assert.equal(right.a.games, 17);
  close(left.b.strength, 50); close(right.b.strength, 50);
  assert.notEqual(left.a.strength, right.a.strength);
  const changed = changeRecordSport(c, 'B', 'mlb');
  assert.equal(changed.recordSportA, 'nba'); assert.equal(changed.recordA, 50);
  assert.equal(c.recordSportB, 'nfl'); assert.equal(c.recordB, 10);
  assert.doesNotThrow(() => validateConfig({ ...c, recordA: 5, recordB: 15 }));
});
test('changing Team B cannot change Team A odds in benchmark mode', () => {
  const c = { ...defaultConfig(), comparison: 'benchmark', right: scenario('nfl'), trials: 1000 }, first = runExperiment(c);
  const second = runExperiment({ ...c, recordB: 14 });
  close(first.left.exact.win, second.left.exact.win);
  assert.deepEqual(first.left.simulation, second.left.simulation);
  assert.ok(second.right.exact.win > first.right.exact.win);
  assert.equal(first.left.subject, 'A'); assert.equal(first.right.subject, 'B');
  close(first.bridge.at(-1), first.right.exact.win);
  const typicalWins = rateAtRank('nba', .5) * 82;
  const typical = comparisonMatchup({ ...c, recordA: typicalWins }, 'nba', 'A');
  close(evaluate(c.left, typical.a.strength, typical.b.strength, c.basis).single, .5, 1e-6);
});
test('v2 links retain A-vs-B meaning and unchanged NBA source strengths', () => {
  const old = { version: 2, recordSport: 'nba', winsA: 60, winsB: 45, matching: 'rarity', basis: 'history', trials: 1000, seed: 42, left: scenario('nba'), right: scenario('nhl') };
  const c = validateConfig(old);
  assert.equal(c.version, 4); assert.equal(c.comparison, 'matchup');
  assert.equal(c.recordSportA, 'nba'); assert.equal(c.recordSportB, 'nba');
  for (const side of ['left', 'right']) {
    const m = comparisonMatchup(c, c[side].sport, side === 'left' ? 'A' : 'B');
    close(m.a.strength, 100 * recordRank('nba', 60 / 82));
    close(m.b.strength, 100 * recordRank('nba', 45 / 82));
  }
  const r = runExperiment(c); assert.equal(r.bridge.length, 4); assert.equal(r.right.subject, 'A');
});
