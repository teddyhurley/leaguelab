import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = file => readFile(path.join(root, file), 'utf8');
const stripModule = source => source.replace(/^import .*;\r?\n/gm, '').replace(/^export (?=(?:const|function) )/gm, '');
const presets = stripModule(await read('dist/src/presets.js'));
const historyData = stripModule(await read('dist/src/history-data.js'));
const history = stripModule(await read('dist/src/history.js'));
const engine = stripModule(await read('dist/src/engine.js'));
const exports = stripModule(await read('dist/src/exports.js'));
const worker = stripModule(await read('dist/src/worker.js'));
const app = stripModule(await read('dist/src/app.js')).replace("new Worker(new URL('./worker.js', import.meta.url), { type: 'module' })", 'new Worker(LEAGUELAB_WORKER_URL)');
if (app.includes('import.meta')) throw new Error('Unresolved module reference in standalone app.');
const workerSource = [historyData, history, presets, engine, worker].join('\n');
new Function(workerSource);
const js = `const LEAGUELAB_WORKER_URL = URL.createObjectURL(new Blob([${JSON.stringify(workerSource)}], {type:'text/javascript'}));\n${historyData}\n${history}\n${presets}\n${engine}\n${exports}\n${app}`;
// The same engine and UI ship in both forms; no duplicate implementation.
new Function(js);
const html = (await read('dist/index.html'))
  .replace('<link rel="icon" href="./favicon.svg" type="image/svg+xml">', '')
  .replace('<link rel="stylesheet" href="./style.css">', `<style>${await read('dist/style.css')}</style>`)
  .replace('<script type="module" src="./src/app.js"></script>', '')
  .replace('</body>', `<script>${js.replace(/<\/script/gi, '<\\/script')}</script></body>`);
const destination = path.resolve(process.argv[2] || path.join(root, 'LeagueLab.html'));
await writeFile(destination, html);
console.log(`Standalone demo saved: ${destination}`);
