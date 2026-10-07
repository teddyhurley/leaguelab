import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

test('preview serves modules, styles and nested assets with correct types and blocks traversal', { timeout: 10000 }, async t => {
  const child = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: fileURLToPath(new URL('../', import.meta.url)), env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => child.kill());
  const [chunk] = await once(child.stdout, 'data');
  const url = chunk.toString().match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
  assert.ok(url, 'Server prints its actual bound URL.');
  for (const [asset, type] of [['/', 'text/html'], ['/style.css', 'text/css'], ['/src/app.js', 'text/javascript'], ['/src/worker.js', 'text/javascript'], ['/src/engine.js', 'text/javascript'], ['/src/presets.js', 'text/javascript'], ['/favicon.svg', 'image/svg+xml']]) {
    const response = await fetch(url + asset); assert.equal(response.status, 200, asset); assert.ok(response.headers.get('content-type').startsWith(type)); assert.ok((await response.text()).length > 0);
  }
  assert.equal((await fetch(url + '/missing')).status, 404);
  assert.equal((await fetch(url + '/%2e%2e%2fpackage.json')).status, 403);
  assert.equal((await fetch(url, { method: 'POST' })).status, 405);
});
