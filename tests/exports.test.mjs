import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultConfig, validateConfig } from '../dist/src/presets.js';
import { runExperiment } from '../dist/src/engine.js';
import { experimentLink, configFromLink, exportJSON, exportCSV } from '../dist/src/exports.js';

const config = defaultConfig(); config.trials = 1000; config.right.home = .11; config.right.rest = -.07; config.right.volatility = .35;
const result = runExperiment(config);
test('shared links round-trip full settings and work under a repository subpath', () => {
  const link = experimentLink(config, 'https://example.org/leaguelab/?old=1#methodology');
  assert.equal(new URL(link).pathname, '/leaguelab/'); assert.equal(new URL(link).hash, '#simulator'); assert.equal(new URL(link).searchParams.has('old'), false);
  assert.deepEqual(configFromLink(link), validateConfig(config));
  assert.deepEqual(runExperiment(configFromLink(link)).right.simulation, result.right.simulation);
});
test('malformed, excessive and unsupported link payloads are rejected', () => {
  assert.equal(configFromLink('https://example.org/'), null);
  for (const payload of ['%%%', 'x'.repeat(5001), btoa('{"version":88}')]) assert.throws(() => configFromLink('https://example.org/?experiment=' + encodeURIComponent(payload)));
  assert.throws(() => experimentLink(config, 'file:///local/LeagueLab.html'), /hosted app/);
});
test('JSON export retains enough information to reproduce both scenarios', () => {
  const parsed = JSON.parse(exportJSON(result));
  assert.deepEqual(parsed.config, validateConfig(config));
  const rerun = runExperiment(parsed.config);
  for (const side of ['left', 'right']) assert.deepEqual(parsed[side].simulation, rerun[side].simulation);
  assert.deepEqual(parsed.headToHead, rerun.headToHead);
  assert.match(parsed.interpretation, /Monte Carlo error/);
});
test('CSV has a consistent header and two scenario rows with recoverable numeric parameters', () => {
  const [header, ...rows] = exportCSV(result).trim().split('\r\n').map(row => row.split(','));
  assert.equal(rows.length, 2);
  for (const row of rows) {
    assert.equal(row.length, header.length);
    const record = Object.fromEntries(header.map((key, i) => [key, row[i]]));
    assert.equal(Number(record.exact_probability), result[record.scenario].exact.win);
    assert.equal(Number(record.rest_edge), config[record.scenario].rest);
    assert.equal(Number(record.seed), config.seed);
    assert.equal(Number(record.trials), config.trials);
    assert.equal(record.result_role, record.scenario === 'left' ? 'main_head_to_head' : 'alternative_rules');
    assert.equal(Number(record.opponent_trial_wins) + Number(record.focal_team_trial_wins), config.trials);
    assert.ok(Math.abs(Number(record.opponent_exact_probability) + Number(record.exact_probability) - 1) < 1e-12);
  }
});
