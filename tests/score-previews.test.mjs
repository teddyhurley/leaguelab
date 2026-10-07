import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultConfig, scenario, updateStartingRules } from '../dist/src/presets.js';
import { runExperiment, scorePreviewGroups } from '../dist/src/engine.js';

const sameLeague = () => ({ ...defaultConfig(), trials: 1000, recordSportA: 'nhl', recordSportB: 'nhl', recordA: 110, recordB: 90, left: scenario('nhl'), right: scenario('nhl') });

test('identical source, starting and experiment games merge and retain every role', () => {
  const r = runExperiment(sameLeague());
  assert.equal(r.scorePreviews.length, 1);
  assert.deepEqual(r.scorePreviews[0].roles, ['teamA', 'teamB', 'matchup', 'experiment']);
  assert.deepEqual(r.scorePreviews[0].distribution, r.left.distribution);
  assert.deepEqual(r.scorePreviews[0].distribution, r.right.distribution);
});
test('modified NHL scoring keeps standard and experiment distributions separately', () => {
  const c = sameLeague(); c.right.scoring = 3;
  const r = runExperiment(c), [base, experiment] = r.scorePreviews;
  assert.deepEqual(r.scorePreviews.map(p => p.sport), ['nhl', 'nhl']);
  assert.deepEqual(base.roles, ['teamA', 'teamB', 'matchup']);
  assert.deepEqual(experiment.roles, ['experiment']);
  assert.deepEqual(base.distribution, r.left.distribution);
  assert.deepEqual(experiment.distribution, r.right.distribution);
  assert.notDeepEqual(base.distribution, experiment.distribution);
  assert.ok(experiment.scoreA > base.scoreA && experiment.scoreB > base.scoreB);
  c.right = { ...c.left }; assert.equal(scorePreviewGroups(c).length, 1);
});
test('changed starting and experiment rules do not erase the standard league chart', () => {
  const c = sameLeague(); c.left.scoring = 2; c.right.scoring = 3;
  assert.deepEqual(scorePreviewGroups(c).map(p => p.roles), [['teamA', 'teamB'], ['matchup'], ['experiment']]);
});
test('two source leagues plus two distinct hockey scenarios produce four charts', () => {
  const c = { ...defaultConfig(), left: scenario('nhl'), right: { ...scenario('nhl'), scoring: 3 } };
  assert.deepEqual(scorePreviewGroups(c).map(p => p.sport), ['nba', 'nfl', 'nhl', 'nhl']);
});
test('series-only changes share a score chart while series odds differ', () => {
  const c = sameLeague(); c.right.series = 1;
  const r = runExperiment(c);
  assert.equal(r.scorePreviews.length, 1);
  assert.notEqual(r.left.exact.win, r.right.exact.win);
  assert.deepEqual(r.left.distribution, r.right.distribution);
});
test('game mechanics and active home/rest effects distinguish charts', () => {
  for (const change of [{ opportunities: 1.5 }, { sensitivity: 1.5 }, { volatility: .5 }, { noise: 2 }, { home: .15 }, { rest: .1 }]) {
    const c = sameLeague(); Object.assign(c.right, change);
    assert.equal(scorePreviewGroups(c).length, 2, JSON.stringify(change));
  }
  const neutral = sameLeague(); neutral.right.host = 'b';
  assert.equal(scorePreviewGroups(neutral).length, 1);
  const venues = sameLeague(); venues.left.home = .15; venues.right = { ...venues.left, host: 'b' };
  assert.equal(scorePreviewGroups(venues).length, 3);
});
test('an experiment matching another source league merges with its chart', () => {
  const c = { ...defaultConfig(), right: scenario('nfl') };
  assert.deepEqual(scorePreviewGroups(c).map(p => p.roles), [['teamA', 'matchup'], ['teamB', 'experiment']]);
});
test('equal-record benchmark subjects retain separate charts in the same league', () => {
  const groups = scorePreviewGroups({ ...sameLeague(), comparison: 'benchmark', recordB: 110 });
  assert.deepEqual(groups.map(p => p.roles), [['teamA', 'matchup'], ['teamB', 'experiment']]);
  assert.deepEqual(groups.map(p => p.subject), ['A', 'B']);
});

test('a new experiment follows starting edits without sharing mutable state', () => {
  const c = defaultConfig();
  assert.deepEqual(c.left, c.right);
  const next = updateStartingRules(c, { ...scenario('nhl'), series: 3 });
  assert.deepEqual(next.left, next.right);
  next.right.scoring = 2;
  assert.equal(next.left.scoring, 1);
  assert.equal(c.left.sport, 'nba');
});

test('starting edits preserve a customized experiment and both source records', () => {
  const c = defaultConfig(); c.right.scoring = 2;
  const next = updateStartingRules(c, { ...c.left, series: 7 });
  assert.deepEqual(next.right, c.right);
  for (const key of ['recordSportA', 'recordSportB', 'recordA', 'recordB']) assert.equal(next[key], c[key]);
});
