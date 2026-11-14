// Builds nothing: run `npm run build` first. Serves dist/ and runs the browser suites.
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';

if (!existsSync('dist/index.html')) {
  console.error('dist/index.html missing: run `npm run build` first');
  process.exit(1);
}
const page = readFileSync('dist/index.html');
const server = createServer((req, res) => {
  if (req.url.split('?')[0] === '/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(page); return; }
  res.writeHead(404); res.end();
}).listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const url = `http://127.0.0.1:${server.address().port}/?test`;

let failed = false;
for (const suite of ['tests/solo.mjs', 'tests/online.mjs', 'tests/scores.mjs', 'tests/looks.mjs', 'tests/start.mjs', 'tests/touch.mjs', 'tests/blasts.mjs']) {
  console.log(`\n== ${suite}`);
  // async on purpose: a blocking spawn would stall this process's test server
  const code = await new Promise((r) => spawn(process.execPath, [suite, url], { stdio: 'inherit' }).on('exit', r));
  if (code !== 0) failed = true;
}
server.close();
process.exit(failed ? 1 : 0);
