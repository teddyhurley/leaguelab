import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultConfig, scenario } from '../dist/src/presets.js';
import { runExperiment } from '../dist/src/engine.js';
const config = { ...defaultConfig(), trials: 1000 };
const result = runExperiment(config);
const close = (a, b, tolerance = 1e-6) => assert.ok(Math.abs(a - b) < tolerance, `${a} differs from ${b}`);

test('default is one head-to-head with complementary odds, counts and outcomes', () => {
  assert.equal(config.comparison, 'matchup');
  const h = result.headToHead;
  assert.equal(h.scenario, 'left'); assert.deepEqual(h.rules, config.left);
  close(h.exact.a + h.exact.b, 1); close(h.simulation.pA + h.simulation.pB, 1);
  assert.equal(h.simulation.winsA + h.simulation.winsB, config.trials);
  assert.deepEqual(h.simulation.winners, result.left.simulation.samples.map(w => w ? 'A' : 'B'));
  close(h.simulation.intervalA[0], 1 - h.simulation.intervalB[1]);
  close(h.simulation.intervalA[1], 1 - h.simulation.intervalB[0]);
});
test('stronger B lowers A odds; swapping teams reverses exact odds', () => {
  const strongerB = runExperiment({ ...config, recordB: 60 });
  assert.ok(strongerB.headToHead.exact.a < result.headToHead.exact.a);
  assert.ok(strongerB.headToHead.exact.b > result.headToHead.exact.b);
  const swapped = runExperiment({ ...config, recordSportA: config.recordSportB, recordSportB: config.recordSportA, recordA: config.recordB, recordB: config.recordA });
  close(swapped.headToHead.exact.a, result.headToHead.exact.b);
  const tied = runExperiment({ ...config, recordSportB: 'nba', recordB: config.recordA });
  close(tied.headToHead.exact.a, .5);
});
test('alternate rules are separate from the primary matchup; benchmark links retain old meaning', () => {
  const alternate = runExperiment({ ...config, right: { ...config.right, series: 7, rest: .2 } });
  assert.deepEqual(alternate.headToHead, result.headToHead);
  const benchmark = runExperiment({ ...config, comparison: 'benchmark', recordSportB: 'nfl', recordB: 10, right: scenario('nfl') });
  assert.equal(benchmark.headToHead, null);
});
