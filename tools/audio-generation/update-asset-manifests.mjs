import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'config/music-cues.json'), 'utf8'));

function update(file, makeEntry) {
  const document = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  const collection = document.assets;
  const existing = new Set(collection.map((entry) => entry.path));
  for (const cue of config.cues) {
    const assetPath = `assets/audio/music/${cue.cueId}.ogg`;
    if (!existing.has(assetPath)) collection.push(makeEntry(cue, assetPath));
  }
  fs.writeFileSync(path.join(root, file), `${JSON.stringify(document, null, 2)}\n`, 'utf8');
}

update('assets/asset-manifest.json', (cue, assetPath) => ({
  id: `music-${cue.cueId}`,
  family: 'music',
  path: assetPath,
  status: 'integrated',
  runtime: `Semantic music cue ${cue.cueId}; ${cue.purpose}`,
  creationMethod: 'ACE-Step 1.5 local generation; normalized and encoded to OGG Vorbis q4',
  createdAt: '2026-10-06',
  format: 'OGG Vorbis',
  loopable: cue.loopable,
  cueId: cue.cueId,
  generator: 'ACE-Step 1.5'
}));

update('assets/provenance/rights-manifest.json', (cue, assetPath) => ({
  path: assetPath,
  method: 'ACE-Step 1.5 local generation from machine-readable music cue spec; normalized and encoded to OGG Vorbis q4',
  source: 'ACE-Step/Ace-Step1.5, ACE-Step 1.5 v0.1.8, local CPU generation',
  license: 'ACE-Step code and model MIT; generated output permitted for commercial use per official model card',
  cueId: cue.cueId,
  loopable: cue.loopable
}));

console.log(`Updated audio entries for ${config.cues.length} cues.`);
