import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const arg = name => process.argv[process.argv.indexOf(name) + 1];
const base = arg('--base'); const head = arg('--head') ?? 'HEAD';
if (!base) throw new Error('Usage: node tools/release/art-input-delta.mjs --base <commit> [--head <commit>]');
const git = args => execFileSync('git', args, { cwd: root, encoding: 'buffer', maxBuffer: 32 * 1024 * 1024 });
const text = args => git(args).toString('utf8').trim();
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const manifestPaths = ref => {
  const manifest = JSON.parse(text(['show', `${ref}:assets/asset-manifest.json`]));
  const paths = new Set(['assets/asset-manifest.json', 'src/literary-visual-directions.js', 'src/literary-stage.js', 'src/literary-player.js', 'src/literary.css', 'src/styles.css', 'literary.html']);
  for (const asset of [...(manifest.assets ?? []), ...(manifest.previewAssets ?? [])]) for (const key of ['path', 'portraitAsset', 'runtimePath', 'runtimePortraitAsset']) if (typeof asset[key] === 'string' && asset[key].startsWith('assets/')) paths.add(asset[key]);
  return [...paths].sort();
};
const inputs = ref => Object.fromEntries(manifestPaths(ref).map(file => [file, sha(git(['show', `${ref}:${file}`]))]));
const before = inputs(base), after = inputs(head), all = new Set([...Object.keys(before), ...Object.keys(after)]);
const changed = [...all].filter(file => before[file] !== after[file]).sort();
console.log(JSON.stringify({ schemaVersion: 1, base: text(['rev-parse', base]), head: text(['rev-parse', head]), before, after, changed, status: changed.length ? 'CHANGED' : 'IDENTICAL' }, null, 2));
