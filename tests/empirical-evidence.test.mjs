import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HISTORY } from '../dist/src/history-data.js';
import { defaultConfig, scenario, SPORTS } from '../dist/src/presets.js';
import { modelEvidence, runExperiment } from '../dist/src/engine.js';
import { configFromLink, exportCSV } from '../dist/src/exports.js';
const read = name => JSON.parse(readFileSync(new URL('../data/history/' + name, import.meta.url)));
const features = read('feature-audit.json');
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-10, `${a} != ${b}`);

test('five fits have actual outcome cohorts and explicit temporal holdouts', () => {
  const counts = { nba: [834, 250], nhl: [870, 262], mlb: [393, 124], nfl: [120, 39], soccer: [2795, 837] };
  for (const [sport, [all, heldOut]] of Object.entries(counts)) {
    const h = HISTORY[sport];
    assert.equal(h.fit.games, all); assert.equal(h.validation.model.games, heldOut);
    assert.equal(h.validation.trainingGames + heldOut, all);
    assert.ok(h.fit.maxAbsStrengthGap > 0);
    const s = SPORTS[sport];
    close(s.n * s.p * s.rewards.reduce((n, [value, mass]) => n + value * mass, 0), h.meanScore);
  }
  assert.equal(HISTORY.soccer.fit.drawGames, 634);
  assert.ok(HISTORY.mlb.validation.model.brier > HISTORY.mlb.validation.homeOnly.brier);
});

test('playoff predictors reconcile to actual preceding regular-season results', () => {
  for (const sport of ['mlb', 'nfl']) {
    const games = read(sport + '-games.json'), lookup = new Map(games.map(g => [g.gameId, g]));
    const records = new Map();
    for (const g of games.filter(g => g.phase === 'regular')) {
      for (const [team, score, opponent] of [[g.homeId, g.homeScore, g.awayScore], [g.awayId, g.awayScore, g.homeScore]]) {
        const key = g.season + ':' + team, r = records.get(key) || [0, 0];
        r[0] += Number(score > opponent); r[1]++; records.set(key, r);
      }
    }
    for (const row of features[sport].rows) {
      const g = lookup.get(row.gameId); assert.equal(g.phase, 'playoff');
      assert.ok(row.recordThrough < row.date);
      assert.deepEqual(row.homeRecord, records.get(g.season + ':' + g.homeId));
      assert.deepEqual(row.awayRecord, records.get(g.season + ':' + g.awayId));
      close(row.homeRate, row.homeRecord[0] / row.homeRecord[1]);
      assert.equal(row.venue, g.neutral ? 0 : 1);
    }
  }
});

test('Premier League features use prior dates only and retain draw credit', () => {
  const games = read('soccer-games.json'), lookup = new Map(games.map(g => [g.gameId, g]));
  assert.equal(games.length, 3800); assert.equal(new Set(games.map(g => g.gameId)).size, 3800);
  for (const row of features.soccer.rows) {
    assert.ok(row.recordThrough < row.date);
    assert.ok(row.homeRecord[1] >= 10 && row.awayRecord[1] >= 10);
    const g = lookup.get(row.gameId);
    assert.equal(row.outcome, g.homeScore > g.awayScore ? 1 : g.homeScore < g.awayScore ? 0 : .5);
  }
  // Independently reconstruct the first and last eligible matchup each season.
  for (let year = 2016; year <= 2025; year++) {
    const eligible = features.soccer.rows.filter(r => r.season === year);
    for (const row of [eligible[0], eligible.at(-1)]) {
      const g = lookup.get(row.gameId);
      for (const side of ['home', 'away']) {
        const team = g[side + 'Id']; let points = 0, played = 0;
        for (const prior of games.filter(x => x.season === year && x.date.slice(0, 10) < row.date)) {
          if (![prior.homeId, prior.awayId].includes(team)) continue;
          const margin = (prior.homeScore - prior.awayScore) * (prior.homeId === team ? 1 : -1);
          points += margin > 0 ? 3 : margin === 0 ? 1 : 0; played++;
        }
        assert.deepEqual(row[side + 'Record'], [points, played]);
        close(row[side + 'Rate'], points / (3 * played));
      }
    }
  }
});

test('result evidence distinguishes historical odds from rule changes and weak fits', () => {
  for (const sport of Object.keys(SPORTS)) {
    const s = scenario(sport), base = modelEvidence(s, 70, 50);
    assert.equal(base.kind, 'historical'); assert.equal(base.weakValidation, sport === 'mlb');
    assert.equal(modelEvidence({ ...s, series: 3 }, 70, 50).kind, 'historical');
    for (const change of [{ scoring: 2 }, { opportunities: 2 }, { home: .1 }, { rest: .1 }, { noise: 0 }])
      assert.equal(modelEvidence({ ...s, ...change }, 70, 50).kind, 'counterfactual');
    assert.equal(modelEvidence(s, 70, 50, 'mechanics').kind, 'controlled');
    assert.equal(modelEvidence(s, 99.99, .01).outsideFit, true);
  }
});

test('v4 links retain records and disclose changed fits; exports retain evidence', () => {
  const old = { ...defaultConfig(), version: 4, trials: 1000, left: scenario('mlb'), right: { ...scenario('soccer'), scoring: 2 } };
  const notices = [], current = configFromLink('https://example.org/?experiment=' + encodeURIComponent(btoa(JSON.stringify(old))), m => notices.push(m));
  assert.equal(current.version, 5); assert.equal(current.recordA, old.recordA); assert.equal(current.recordB, old.recordB);
  assert.deepEqual(current.left, old.left); assert.equal(notices.length, 1); assert.match(notices[0], /odds may change/);
  const result = runExperiment(current);
  assert.equal(result.left.evidence.kind, 'historical'); assert.equal(result.left.evidence.weakValidation, true);
  assert.equal(result.right.evidence.kind, 'counterfactual');
  const [header, ...rows] = exportCSV(result).trim().split('\r\n').map(row => row.split(','));
  for (const row of rows) {
    assert.equal(row.length, header.length);
    const r = Object.fromEntries(header.map((key, i) => [key, row[i]]));
    assert.equal(r.evidence_kind, result[r.scenario].evidence.kind);
    assert.equal(Number(r.fit_games), result[r.scenario].evidence.fitGames);
  }
});
