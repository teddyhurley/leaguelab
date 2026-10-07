import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HISTORY } from '../dist/src/history-data.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const scratch = await mkdtemp(path.join(tmpdir(), 'leaguelab-history-'));

// Allow only negligible libm differences across Python/OS versions.
// Structure, labels and integer counts must still match exactly.
function compare(expected, actual, location = 'root') {
  if (typeof expected === 'number' && typeof actual === 'number') {
    if (Number.isInteger(expected)) assert.equal(actual, expected, location);
    else assert.ok(Number.isFinite(actual) && Math.abs(expected - actual) <= 1e-10 * Math.max(1, Math.abs(expected)), `${location}: ${actual} differs from ${expected}`);
  } else if (expected !== null && typeof expected === 'object') {
    assert.ok(actual !== null && typeof actual === 'object', location);
    assert.equal(Array.isArray(actual), Array.isArray(expected), location);
    assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort(), location);
    for (const key of Object.keys(expected)) compare(expected[key], actual[key], `${location}.${key}`);
  } else assert.equal(actual, expected, location);
}

try {
  await mkdir(path.join(scratch, 'scripts/history'), { recursive: true });
  await mkdir(path.join(scratch, 'dist/src'), { recursive: true });
  await cp(path.join(root, 'scripts/history'), path.join(scratch, 'scripts/history'), { recursive: true });
  await cp(path.join(root, 'data/history'), path.join(scratch, 'data/history'), { recursive: true });
  const build = spawnSync('python3', [path.join(scratch, 'scripts/history/build.py')], { encoding: 'utf8', timeout: 60_000 });
  if (build.error) throw new Error('Historical verification requires Python 3 on PATH.', { cause: build.error });
  assert.equal(build.status, 0, `Historical rebuild failed:\n${build.stderr}\n${build.stdout}`);
  const generated = await readFile(path.join(scratch, 'dist/src/history-data.js'), 'utf8');
  const prefix = 'export const HISTORY = ';
  assert.ok(generated.includes(prefix) && generated.trimEnd().endsWith(';'), 'Unexpected generated module format');
  compare(HISTORY, JSON.parse(generated.slice(generated.indexOf(prefix) + prefix.length).trim().slice(0, -1)), 'HISTORY');
  const expected = JSON.parse(await readFile(path.join(root, 'data/history/validation.json'), 'utf8'));
  const actual = JSON.parse(await readFile(path.join(scratch, 'data/history/validation.json'), 'utf8'));
  compare(expected, actual, 'validation');
  compare(JSON.parse(await readFile(path.join(root, 'data/history/feature-audit.json'), 'utf8')), JSON.parse(await readFile(path.join(scratch, 'data/history/feature-audit.json'), 'utf8')), 'feature-audit');
  console.log('Offline snapshots reproduce all five record scales, game fits, pregame features and holdout results. Source files unchanged.');
} finally {
  await rm(scratch, { recursive: true, force: true });
}
