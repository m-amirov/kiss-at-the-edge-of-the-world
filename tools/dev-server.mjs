/** Minimal local-only static preview server. Not a Yandex SDK/platform simulation. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const host='127.0.0.1';const port=Number(process.env.PORT||4173);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.md':'text/plain; charset=utf-8'};
http.createServer((req,res)=>{
 try {
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Allow':'GET, HEAD'});res.end();return}
  const url=new URL(req.url,`http://${host}:${port}`);
  // Yandex serves this path in production. Keep local fallback semantics without
  // turning a static production bootstrap into a development 404 or SDK mock.
  if(url.pathname==='/sdk.js'){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Content-Length':'0','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end();return}
  const relative=decodeURIComponent(url.pathname).replace(/^\/+/, '')||'index.html';
  const full=path.resolve(root,relative);
  if(!full.startsWith(root+path.sep)||full.includes(`${path.sep}.git${path.sep}`)) {res.writeHead(403);res.end();return}
  const stat=fs.statSync(full);
  if(!stat.isFile()){res.writeHead(404);res.end();return}
  res.writeHead(200,{'Content-Type':types[path.extname(full).toLowerCase()]||'application/octet-stream','Content-Length':stat.size,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  if(req.method==='HEAD'){res.end();return}
  fs.createReadStream(full).pipe(res);
 } catch(error){res.writeHead(error.code==='ENOENT'?404:400);res.end('Not found')}
}).listen(port,host,()=>console.log(`LOCAL_PREVIEW http://${host}:${port}/ (literary: /literary.html ; S18: /?preview=s18)`));
