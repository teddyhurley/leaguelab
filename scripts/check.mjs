import { readFile, readdir, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
for (const file of ['dist/index.html', 'dist/style.css', 'dist/favicon.svg', 'dist/src/worker.js', 'README.md', 'LICENSE', 'docs/MODEL.md', 'docs/PRODUCT.md', 'docs/HISTORY.md', 'docs/ARCHITECTURE.md', 'docs/VERIFICATION.md', 'docs/preview.png', 'docs/EVIDENCE.md']) await access(path.join(root, file));
for (const dir of ['dist/src', 'scripts', 'tests']) for (const name of await readdir(path.join(root, dir))) {
  if (!/\.(m?js)$/.test(name)) continue;
  const file = path.join(root, dir, name), check = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (check.error) throw check.error;
  if (check.status !== 0) process.exit(check.status ?? 1);
}
const html = await readFile(path.join(root, 'dist/index.html'), 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
if (new Set(ids).size !== ids.length) throw new Error('Duplicate HTML IDs.');
if (/TODO|Lorem ipsum|codex-preview/.test(html)) throw new Error('Unfinished placeholder in shipped HTML.');
console.log('Source syntax, entry assets, documentation, and HTML IDs verified. Static app is ready in dist/.');
