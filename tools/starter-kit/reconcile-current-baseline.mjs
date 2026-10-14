import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT } from './lib.mjs';

const expectedHead = process.argv[process.argv.indexOf('--head') + 1];
if (!expectedHead || process.argv[2] !== '--accept-current') {
  throw new Error('Usage: node tools/starter-kit/reconcile-current-baseline.mjs --accept-current --head <exact-HEAD>');
}

const actualHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
if (actualHead !== expectedHead) throw new Error(`HEAD mismatch: expected ${expectedHead}, got ${actualHead}`);

const stateFile = path.join(ROOT, '.starter-kit', 'state.json');
const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
const sha256File = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const reconciled = [];

for (const [logicalId, baseline] of Object.entries(state.baseline ?? {})) {
  const target = path.join(ROOT, baseline.target);
  if (!fs.existsSync(target)) throw new Error(`Managed baseline target is missing: ${baseline.target}`);
  const currentHash = sha256File(target);
  if (baseline.targetHash !== currentHash) {
    reconciled.push({
      logicalId,
      target: baseline.target,
      sourceHash: baseline.sourceHash,
      previousTargetHash: baseline.targetHash,
      currentTargetHash: currentHash,
      size: fs.statSync(target).size
    });
    baseline.targetHash = currentHash;
  }
}

fs.writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  status: 'PASS',
  head: actualHead,
  reconciledCount: reconciled.length,
  reconciled
}, null, 2));
