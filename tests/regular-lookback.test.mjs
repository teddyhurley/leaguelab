import test from 'node:test';
import assert from 'node:assert/strict';
import { HISTORY } from '../dist/src/history-data.js';
import { scenario, defaultConfig } from '../dist/src/presets.js';
import { modelEvidence, runExperiment } from '../dist/src/engine.js';
import { matchupFor } from '../dist/src/history.js';
import { configFromLink, exportCSV } from '../dist/src/exports.js';

test('regular-season samples cover teams that missed playoffs and retain subgroup failures', () => {
  for (const sport of ['nba', 'nhl', 'nfl']) {
    const h = HISTORY[sport], sub = h.validation.subgroups;
    assert.equal(h.fit.retrospective, true);
    assert.match(h.fit.scope, /Regular-season.*all teams/);
    assert.ok(sub.bothMissedPlayoffs.model.games > 0);
    assert.equal(sub.nonPlayoffParticipants.model.games + sub.bothReachedPlayoffs.model.games, h.validation.model.games);
    assert.equal(h.playoffValidation.playoffRefit.usedInApp, false);
    assert.equal(h.fit.playoffAdjustmentApplied, false);
    assert.ok(h.playoffValidation.training.includes('regular seasons'));
  }
  const nfl = HISTORY.nfl.validation.subgroups.bothMissedPlayoffs;
  assert.equal(nfl.model.games, 242);
  assert.ok(nfl.model.brier > nfl.homeOnly.brier);
  assert.ok(modelEvidence(scenario('nfl'), 20, 30).subgroupWarnings.some(w => w.group === 'bothMissedPlayoffs'));
  assert.equal(HISTORY.nfl.fit.excludedTiedTargets, 9);
});

test('coverage checks each team even when two unsupported strengths have a small gap', () => {
  for (const sport of ['nba', 'nhl', 'nfl', 'soccer']) {
    const e = modelEvidence(scenario(sport), .001, .002);
    assert.equal(e.outsideGap, false);
    assert.deepEqual(e.outsideTeam, [true, true]);
    assert.equal(e.outsideFit, true);
  }
  const c = { ...defaultConfig(), recordSportA: 'nba', recordSportB: 'nba', recordA: 20, recordB: 30 };
  const m = matchupFor(c, 'nba'), e = modelEvidence(scenario('nba'), m.a.strength, m.b.strength);
  assert.equal(e.fitGames, 11979); assert.equal(e.retrospective, true); assert.equal(e.outsideFit, false);
});

test('old playoff-baseline links disclose the new all-team lookback and exports carry support flags', () => {
  const old = { ...defaultConfig(), version: 7, trials: 1000 };
  const messages = [];
  const c = configFromLink('https://example.org/?experiment=' + encodeURIComponent(btoa(JSON.stringify(old))), m => messages.push(m));
  assert.deepEqual(c, { ...old, version: 9 });
  assert.match(messages[0], /all-team regular-season lookbacks/); assert.match(messages[0], /hindsight/);
  const r = runExperiment(c), [header, ...rows] = exportCSV(r).trim().split('\r\n').map(row => row.split(','));
  for (const row of rows) {
    const values = Object.fromEntries(header.map((h, i) => [h, row[i]]));
    assert.equal(values.retrospective, 'true');
    assert.equal(values.outside_fit_support, String(r[values.scenario].evidence.outsideFit));
    assert.equal(values.outside_fitted_gap, String(r[values.scenario].evidence.outsideGap));
    assert.equal(values.outside_team_a_strength, String(r[values.scenario].evidence.outsideTeam[0]));
  }
});
