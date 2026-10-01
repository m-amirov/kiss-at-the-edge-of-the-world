import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const rel = file => path.relative(root, file).replaceAll('\\', '/');
const add = (list, entry) => {
  const existing = list.find(item => (entry.id && item.id === entry.id) || (entry.path && item.path === entry.path));
  if (existing) Object.assign(existing, entry);
  else list.push(entry);
};
const now = '2026-10-01';

const backgrounds = [
  's03-reykjavik-guesthouse-morning','s06-hveragerdi-geothermal-day','s09-guesthouse-to-skogafoss-morning',
  's10-vik-guesthouse-arrival','s12-vik-street-day','s13-skaftafell-visitor-parking','s14-lagoon-road',
  's15-jokulsarlon-parking-day','s18-hofn-room-morning','s18-hofn-breakfast-morning',
  's26-eastfjords-guesthouse-courtyard','s37-snaefellsnes-guesthouse-day','s39-alice-damir-cafe-walk',
  's40-alice-room-laptop-window','s46-airport-bus-day','s48-guesthouse-exit-morning','s52-hofn-streets-post-workshop'
];
const cgs = [
  ['s03-editor-call-damir','S03 authored Damir-enters morning guesthouse conversation'],
  ['s18-hofn-breakfast-group','S18 authored group breakfast with spatially composed cast'],
  ['s38-alice-nick-ordinary-day','S38 authored Alice/Nick ordinary walk and museum day'],
  ['s54-alice-nick-karaoke','S54 authored Alice/Nick karaoke evening'],
  ['s39-alice-damir-cafe','S39 authored Alice/Damir café conversation after walk'],
  ['s40-alice-laptop-window','S40 authored Alice working at laptop by window'],
  ['s64-alice-snaefellsnes-trail','S64 authored solo Snæfellsnes trail'],
  ['s26-eastfjords-courtyard-group','S26 authored group courtyard transition/route choice'],
  ['s48-guesthouse-exit-group','S48 authored group guesthouse exit']
];
const manifestFile = path.join(root, 'assets/asset-manifest.json');
const rightsFile = path.join(root, 'assets/provenance/rights-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
const rights = JSON.parse(fs.readFileSync(rightsFile, 'utf8'));
for (const id of backgrounds) {
  const png = path.join(root, `assets/backgrounds/${id}.png`);
  const webp = path.join(root, `assets/backgrounds/${id}.webp`);
  add(manifest.assets, { id, family: 'background', path: rel(png), status: 'integrated', runtime: 'authored beat-level environment background', creationMethod: 'Codex imagegen, current production-art run, environment-only', createdAt: now, dimensions: '1920x900', runtimePath: rel(webp) });
  add(rights.assets, { path: rel(png), sha256: sha256(png).toUpperCase(), dimensions: '1920x900', method: 'Codex imagegen current production-art run; environment-only establishing/transition asset', source: 'Generated in Codex imagegen, 2026-10-01', license: 'generated for this project' });
}
for (const [id, runtime] of cgs) {
  const png = path.join(root, `assets/cg/${id}.png`);
  const webp = path.join(root, `assets/cg/${id}.webp`);
  const portraitPng = path.join(root, `assets/cg/${id}-portrait.png`);
  const portraitWebp = path.join(root, `assets/cg/${id}-portrait.webp`);
  add(manifest.assets, { id, family: 'cg', path: rel(png), status: 'integrated', runtime, creationMethod: 'Codex imagegen current production-art run using canonical character references; independent desktop and portrait derivatives', createdAt: now, dimensions: '1920x900', mobileSafe: true, portraitAsset: rel(portraitPng), portraitDimensions: '941x1672', runtimePath: rel(webp), runtimePortraitAsset: rel(portraitWebp) });
  add(rights.assets, { path: rel(png), sha256: sha256(png).toUpperCase(), dimensions: '1920x900', method: 'Codex imagegen current production-art run using canonical character references; exact authored cast/action; desktop CG', source: 'Generated in Codex imagegen, 2026-10-01', license: 'generated for this project' });
  add(rights.assets, { path: rel(portraitPng), sha256: sha256(portraitPng).toUpperCase(), dimensions: '941x1672', method: 'Portrait derivative cropped from the accepted desktop CG for mobile runtime', source: `Derived from ${rel(png)}, 2026-10-01`, license: 'generated for this project' });
}
const menu = path.join(root, 'assets/branding/menu-hero.webp');
add(manifest.assets, { id: 'menu-hero-alice', family: 'branding', path: rel(menu), status: 'integrated', runtime: 'src/literary-player.js menu background/key visual, title-free', creationMethod: 'Codex imagegen using canonical Alice stage reference', createdAt: now, dimensions: '1920x900', runtimePath: rel(menu) });
for (const [id, file, purpose, dimensions] of [
  ['kiss-at-the-edge-cover', 'assets/branding/kiss-at-the-edge-cover.png', 'store cover key visual', '1920x900'],
  ['kiss-at-the-edge-icon', 'assets/branding/kiss-at-the-edge-icon.png', 'small canonical Alice icon', '512x512']
]) {
  const absolute = path.join(root, file);
  add(manifest.assets, { id, family: 'branding', path: file, status: 'integrated', runtime: purpose, creationMethod: 'Codex imagegen using canonical Alice stage reference', createdAt: now, dimensions, runtimePath: file });
  add(rights.assets, { path: file, sha256: sha256(absolute).toUpperCase(), dimensions, method: `Codex imagegen current production-art run; ${purpose}`, source: 'Generated in Codex imagegen, 2026-10-01', license: 'generated for this project' });
}
add(rights.assets, { path: rel(menu), sha256: sha256(menu).toUpperCase(), dimensions: '1920x900', method: 'Codex imagegen current production-art run; title-free menu key visual with canonical Alice', source: 'Generated in Codex imagegen, 2026-10-01', license: 'generated for this project' });
manifest.visualDirection = { ...(manifest.visualDirection ?? {}), currentGate: 'BEAT_LEVEL_VISUAL_REPAIR_INTEGRATED', runId: '2026-10-01T18-36-42-265Z-production-art-4f6b0d' };
rights.generatedAt = now;
fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
fs.writeFileSync(rightsFile, `${JSON.stringify(rights, null, 2)}\n`);
console.log(JSON.stringify({manifestAssets: manifest.assets.length, rightsAssets: rights.assets.length}, null, 2));
