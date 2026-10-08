import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { defaultConfig, scenario } from '../dist/src/presets.js';
import { HISTORY } from '../dist/src/history-data.js';
import { coreComparison, runExperiment, historicalStrengthGap, logit, modelEvidence } from '../dist/src/engine.js';
import { configFromLink } from '../dist/src/exports.js';
const close = (a, b, tolerance = 1e-6) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const c = { ...defaultConfig(), trials: 1000 };
const result = runExperiment(c);

test('opening comparison holds team caliber fixed in NBA, NHL and MLB', () => {
  assert.equal(c.version, 9); assert.equal(c.recordSportA, 'nba'); assert.equal(c.recordSportB, 'nba');
  const rows = coreComparison(result);
  assert.deepEqual(rows.map(r => r.sport), ['nba', 'nhl', 'mlb']);
  for (const r of rows) {
    close(r.matchup.a.rank, .75); close(r.matchup.b.rank, .25);
    close(r.winA + r.winB, 1); assert.equal(r.series, 1);
    const h = HISTORY[r.sport];
    close(r.winA, 1 / (1 + Math.exp(-h.fit.slope * (logit(.75) - logit(.25)))));
  }
  assert.ok(rows[0].winA > rows[1].winA && rows[1].winA > rows[2].winA);
  assert.notEqual(rows[0].matchup.a.rate, rows[2].matchup.a.rate);
});
test('every overview format applies uniformly and survives custom scenario changes', () => {
  for (const series of [1, 3, 5, 7]) {
    const changed = runExperiment({ ...c, left: { ...c.left, series, scoring: 2, home: .2 }, right: { ...scenario('mlb'), opportunities: 2 } });
    const rows = coreComparison(changed);
    for (const r of rows) {
      assert.equal(r.series, series);
      close(r.winA, result.leagues.find(l => l.sport === r.sport).formats[series]);
      if (series > 1) assert.ok(r.winA > coreComparison(result).find(l => l.sport === r.sport).winA);
    }
  }
});
test('reversing the records reverses all core odds; equal caliber is neutral', () => {
  const reversed = coreComparison(runExperiment({ ...c, recordA: c.recordB, recordB: c.recordA }));
  const equal = coreComparison(runExperiment({ ...c, recordB: c.recordA }));
  coreComparison(result).forEach((r, i) => { close(reversed[i].winA, r.winB); close(equal[i].winA, .5); });
});
test('MLB deploys the evaluated completed-season candidate, with its limits', () => {
  close(historicalStrengthGap('mlb', 75, 25), logit(.75) - logit(.25));
  const h = HISTORY.mlb;
  assert.equal(h.fit.games, 22762); assert.equal(h.fit.teamSeasons, 300);
  assert.equal(h.fit.excludedTiedTargets, 1); assert.equal(h.fit.retrospective, true);
  assert.equal(h.fit.strengthScale, 'rarityLogit'); assert.equal(h.playoffValidation.playoffRefit.usedInApp, false);
  assert.ok(h.validation.model.brier < h.validation.homeOnly.brier);
  assert.ok(h.playoffValidation.model.brier > h.playoffValidation.homeOnly.brier);
  assert.ok(modelEvidence(scenario('nba'), 20, 30).subgroupWarnings.some(w => w.group === 'bothBottomQuartile' && w.games === 305));
});
test('observed better-record rates reconcile independently with the feature audit', () => {
  const audit = JSON.parse(readFileSync(new URL('../data/history/feature-audit.json', import.meta.url)));
  for (const sport of ['nba', 'nhl', 'mlb']) {
    const rows = audit[sport === 'mlb' ? 'mlbLookback' : sport].rows.filter(r => r.phase === 'regular' && Math.abs(r.homeRate - r.awayRate) > 1e-10);
    const wins = rows.filter(r => (r.homeRate > r.awayRate) === Boolean(r.outcome)).length;
    assert.equal(HISTORY[sport].observedBetterRecord.games, rows.length);
    assert.equal(HISTORY[sport].observedBetterRecord.wins, wins);
    close(HISTORY[sport].observedBetterRecord.rate, wins / rows.length);
  }
});
test('v8 links preserve independent source records and conditions while disclosing the new MLB model', () => {
  const old = { ...c, version: 8, recordA: 50, recordSportB: 'nfl', recordB: 10, left: scenario('nhl'), right: { ...scenario('mlb'), scoring: 1.5 } };
  const messages = [];
  const migrated = configFromLink('https://example.org/?experiment=' + encodeURIComponent(btoa(JSON.stringify(old))), m => messages.push(m));
  assert.deepEqual(migrated, { ...old, version: 9 });
  assert.match(messages[0], /MLB/); assert.match(messages[0], /completed-season/); assert.match(messages[0], /hindsight/);
});
