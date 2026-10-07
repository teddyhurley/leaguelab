import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HISTORY } from '../dist/src/history-data.js';
import { recordContext, recordRank, changeRecordSport, teamFor } from '../dist/src/history.js';
import { defaultConfig, validateConfig, scenario } from '../dist/src/presets.js';
import { configFromLink, exportCSV, exportJSON, experimentLink } from '../dist/src/exports.js';
import { runExperiment } from '../dist/src/engine.js';
const read = name => JSON.parse(readFileSync(new URL('../data/history/' + name, import.meta.url)));
const hockey = read('nhl-team-seasons.json').filter(r => r.games === 82);
const soccer = read('other-team-seasons.json').teamSeasons.filter(r => r.sport === 'soccer' && r.included);
const close = (a,b) => assert.ok(Math.abs(a-b) < 1e-8, `${a} != ${b}`);

test('point rarity matches NHL standings and EPL earned-points snapshots', () => {
  for (const [sport, rows, points, games, maximum] of [
    ['nhl', hockey, r => r.points, 82, 168],
    ['soccer', soccer, r => 3*r.wins+r.draws, 38, 114]
  ]) {
    assert.equal(HISTORY[sport].recordUnit, 'points');
    assert.equal(HISTORY[sport].maxRecord, maximum);
    for (const selected of [0, 70, 90, 100, maximum]) {
      const context = recordContext(sport, selected/maximum);
      const expected = rows.filter(r => points(r)/(games*HISTORY[sport].maxPerGame) >= selected/maximum-1e-10).length;
      assert.equal(context.atLeast, expected); close(context.value, selected);
    }
  }
  assert.ok(hockey.every(r => r.points === 2*r.wins+r.overtimeLosses));
  assert.equal(Math.max(...soccer.map(r => 3*r.wins+r.draws)), 100);
  const games = read('nhl-playoff-games.json').filter(g => g.betterPointsWin !== null);
  assert.equal(HISTORY.nhl.playoffs.byPointsPct.games.n, games.length);
  assert.equal(HISTORY.nhl.playoffs.byPointsPct.games.wins, games.filter(g => g.betterPointsWin).length);
});
test('draws and overtime losses distinguish equal-win points records', () => {
  for (const [sport, rows, points, max] of [
    ['nhl', hockey, r => r.points, 164], ['soccer', soccer, r => 3*r.wins+r.draws, 114]
  ]) {
    const a = rows.find(r => rows.some(other => other.wins === r.wins && points(other)>points(r)));
    const b = rows.find(r => r.wins === a.wins && points(r)>points(a));
    assert.ok(recordRank(sport, points(b)/max)>recordRank(sport, points(a)/max));
  }
});
test('record-percentage translation respects wins and available-points denominators', () => {
  let c = { ...defaultConfig(), recordA: 41, matching: 'recordRate' };
  c = changeRecordSport(c, 'A', 'nhl'); close(c.recordA, 84);
  c = changeRecordSport(c, 'A', 'soccer'); close(c.recordA, 57);
  c = changeRecordSport(c, 'A', 'nba'); close(c.recordA, 41);
  assert.equal(c.recordB, 10);
});
test('older point-sport links migrate wins by rarity with a notice', () => {
  const old = { ...defaultConfig(), version: 3, recordSportA: 'nhl', recordSportB: 'soccer', winsA: 50, winsB: 25, matching: 'winRate' };
  delete old.recordA; delete old.recordB;
  const messages = [], c = configFromLink('https://example.org/?experiment='+encodeURIComponent(btoa(JSON.stringify(old))), m => messages.push(m));
  assert.equal(c.version, 5); assert.equal(c.matching, 'recordRate');
  assert.ok(c.recordA>100 && c.recordA<130); assert.ok(c.recordB>75 && c.recordB<95);
  assert.equal(messages.length, 1); assert.match(messages[0], /earlier odds may change/);
  assert.ok(!Object.hasOwn(c, 'winsA'));
  assert.deepEqual(configFromLink(experimentLink(c, 'https://example.org/')), c);
  for (const value of [-1, 169, NaN]) assert.throws(() => validateConfig({ ...c, recordA: value }));
  assert.throws(() => validateConfig({ ...c, recordB: 115 }));
  assert.equal(HISTORY.nhl.fit.recordMetric, 'points percentage');
});
test('points records survive simulation, sharing and unit-explicit exports', () => {
  const c = { ...defaultConfig(), recordSportA: 'nhl', recordA: 100, recordSportB: 'soccer', recordB: 70, left: scenario('nhl'), right: scenario('soccer'), trials: 1000 };
  assert.equal(teamFor(c, 'A', 'nhl').unit, 'points');
  const result = runExperiment(c), json = JSON.parse(exportJSON(result));
  assert.deepEqual(json.config, validateConfig(c));
  assert.deepEqual(configFromLink(experimentLink(c, 'https://example.org/')), validateConfig(c));
  const [header,...rows] = exportCSV(result).trim().split('\r\n').map(row => row.split(','));
  for (const row of rows) {
    assert.equal(row.length,header.length);
    const csv = Object.fromEntries(header.map((key,i) => [key,row[i]]));
    assert.equal(csv.reference_record_a,'100'); assert.equal(csv.reference_record_unit_a,'points');
    assert.equal(csv.reference_record_b,'70'); assert.equal(csv.reference_record_unit_b,'points');
    assert.equal(csv.record_unit,'points');
  }
  close(result.headToHead.exact.a+result.headToHead.exact.b,1);
});
