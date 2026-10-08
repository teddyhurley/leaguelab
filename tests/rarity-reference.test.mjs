import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HISTORY } from '../dist/src/history-data.js';
import { recordContext } from '../dist/src/history.js';
import { defaultConfig } from '../dist/src/presets.js';
import { configFromLink } from '../dist/src/exports.js';
const reference = JSON.parse(readFileSync(new URL('../data/history/rarity-reference.json', import.meta.url)));
const expected = {
  nba: { first: 2004, last: 2026, skip: [2012, 2020, 2021], count: 599 },
  nhl: { first: 2003, last: 2026, skip: [2005, 2013, 2020, 2021], count: 612 },
  mlb: { first: 2006, last: 2026, skip: [2020], count: 600 },
  nfl: { first: 2005, last: 2025, skip: [2020], count: 638 },
  soccer: { first: 2005, last: 2026, skip: [2020, 2021], count: 400 }
};
const rate = (r, sport) => sport === 'nhl' ? r.points / (2 * r.games) : sport === 'soccer' ? (3 * r.wins + r.draws) / (3 * r.games) : r.wins / r.games;

test('all five rarity cohorts are the latest 20 eligible completed seasons, with 2021 MLB/NFL retained', () => {
  assert.equal(reference.asOf, '2026-10-07');
  for (const [sport, e] of Object.entries(expected)) {
    const ref = reference.sports[sport], rows = ref.teamSeasons;
    const years = Array.from({ length: e.last - e.first + 1 }, (_, i) => e.first + i).filter(y => !e.skip.includes(y));
    assert.equal(years.length, 20);
    assert.deepEqual(ref.includedSeasonEnds, years);
    assert.deepEqual([...new Set(rows.map(r => r.seasonEnd))].sort(), years);
    assert.equal(rows.length, e.count);
    assert.equal(new Set(rows.map(r => `${r.seasonEnd}:${r.teamId}`)).size, rows.length);
    assert.equal(HISTORY[sport].sampleSize, rows.length);
    assert.deepEqual(HISTORY[sport].reference.includedSeasonEnds, years);
  }
  assert.equal(reference.sports.mlb.teamSeasons.filter(r => r.seasonEnd === 2021).length, 30);
  const nfl2021 = reference.sports.nfl.teamSeasons.filter(r => r.seasonEnd === 2021);
  assert.equal(nfl2021.length, 32); assert.ok(nfl2021.every(r => r.games === 17));
});

test('rarity counts and smoothed ranks independently reconcile to all expanded records', () => {
  for (const [sport, ref] of Object.entries(reference.sports)) {
    const rows = ref.teamSeasons, h = HISTORY[sport];
    for (const r of rows) {
      const x = rate(r, sport), c = recordContext(sport, x);
      const less = rows.filter(v => rate(v, sport) < x - 1e-10).length;
      const equal = rows.filter(v => Math.abs(rate(v, sport) - x) < 1e-10).length;
      assert.equal(c.atLeast, rows.length - less);
      assert.ok(Math.abs(c.rank - (less + equal / 2 + .5) / (rows.length + 1)) < 1e-8);
    }
    assert.equal(h.knots.reduce((n, k) => n + k[2], 0), rows.length);
  }
});

test('full-season exceptions, ties and historical scoring rules survive normalization', () => {
  const nba = reference.sports.nba.teamSeasons;
  assert.ok(nba.every(r => [81, 82].includes(r.games) && r.wins + r.losses === r.games));
  assert.deepEqual(nba.filter(r => r.games === 81).map(r => [r.seasonEnd, r.teamId, r.wins, r.losses]), [[2013, '11', 49, 32], [2013, '2', 41, 40]]);
  for (const r of nba.filter(r => r.games === 81)) {
    const c = recordContext('nba', r.wins / r.games);
    assert.ok(Math.abs(c.value - r.wins * 82 / 81) < 1e-10);
    assert.ok(c.rank > recordContext('nba', r.wins / 82).rank);
  }
  assert.equal(reference.sports.nba.teamSeasons.filter(r => r.seasonEnd === 2004).length, 29);
  assert.equal(reference.sports.nba.teamSeasons.filter(r => r.seasonEnd === 2013).length, 30);
  for (const r of reference.sports.nhl.teamSeasons) {
    assert.equal(r.games, 82);
    assert.equal(r.points, 2 * r.wins + r.overtimeLosses + r.ties);
    assert.equal(r.games, r.wins + r.losses + r.overtimeLosses + r.ties);
  }
  assert.equal(reference.sports.nhl.teamSeasons.filter(r => r.seasonEnd < 2005).length, 60);
  for (const r of reference.sports.mlb.teamSeasons) {
    assert.ok([161, 162, 163].includes(r.games)); assert.equal(r.games, r.wins + r.losses + r.ties);
  }
  for (const r of reference.sports.nfl.teamSeasons) {
    assert.equal(r.games, r.seasonEnd >= 2021 ? 17 : 16);
    assert.equal(r.games, r.wins + r.losses + r.ties);
  }
  for (const r of reference.sports.soccer.teamSeasons) {
    assert.equal(r.games, 38); assert.equal(r.games, r.wins + r.losses + r.draws);
    assert.equal(r.points, 3 * r.wins + r.draws);
  }
});

test('evaluation rarity cannot use records beyond its training cutoff', () => {
  for (const [sport, ref] of Object.entries(reference.sports)) {
    const v = HISTORY[sport].validation.rarityReference;
    const rows = ref.teamSeasons.filter(r => r.seasonEnd <= v.cutoffSeasonEnd);
    assert.equal(v.teamSeasons, rows.length);
    assert.deepEqual(v.includedSeasonEnds, [...new Set(rows.map(r => r.seasonEnd))].sort());
    assert.ok(v.includedSeasonEnds.every(y => y <= v.cutoffSeasonEnd));
  }
  assert.deepEqual(Object.values(HISTORY).map(h => h.fit.games), [11979, 12200, 22762, 2614, 3800]);
});

test('previous 10-season links retain settings and disclose changed rarity and odds', () => {
  const old = { ...defaultConfig(), version: 6, recordSportA: 'mlb', recordA: 95 };
  const notices = [];
  const updated = configFromLink('https://example.org/?experiment=' + encodeURIComponent(btoa(JSON.stringify(old))), m => notices.push(m));
  assert.deepEqual(updated, { ...old, version: 9 });
  assert.equal(notices.length, 1); assert.match(notices[0], /20 eligible completed seasons/);
  assert.match(notices[0], /odds may change/);
});
