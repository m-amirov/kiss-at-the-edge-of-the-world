import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
await run(process.execPath, [path.join(root, 'tools/audio-qa/generate-listening-review.mjs')], { cwd: root, stdio: 'inherit' }).catch(error => { console.error(error.stderr || error.message); process.exit(1); });
const host = '127.0.0.1';
const port = Number(process.env.PORT || 4174);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.ogg': 'audio/ogg', '.png': 'image/png', '.webp': 'image/webp' };
const server = http.createServer((req, res) => {
  try {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return; }
    const url = new URL(req.url, `http://${host}:${port}`);
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'tools/audio-qa/listening-review.html';
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep) || file.includes(`${path.sep}.git${path.sep}`)) { res.writeHead(403); res.end(); return; }
    const stat = fs.statSync(file);
    if (!stat.isFile()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': stat.size, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    if (req.method === 'HEAD') res.end(); else fs.createReadStream(file).pipe(res);
  } catch (error) { res.writeHead(error.code === 'ENOENT' ? 404 : 400); res.end('Not found'); }
});
server.listen(port, host, () => {
  const url = `http://${host}:${port}/tools/audio-qa/listening-review.html`;
  console.log(`AUDIO_LISTENING_REVIEW ${url}`);
  if (process.env.AUDIO_QA_NO_OPEN !== '1') spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
});
