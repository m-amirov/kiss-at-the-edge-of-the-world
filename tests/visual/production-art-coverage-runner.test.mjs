import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const runner = fs.readFileSync(path.join(root, 'tools/visual-qa/production-art-coverage-rc.mjs'), 'utf8');

test('production-art coverage waits for the committed crossfade layer before readback', () => {
  assert.match(runner, /async function waitForCommittedArt\(page\)/);
  assert.match(runner, /image\.dataset\.asset && image\.complete && image\.naturalWidth > 0/);
  assert.match(runner, /await waitForCommittedArt\(page\)/);
  assert.match(runner, /candidate\.dataset\.asset === expectedFile && candidate\.style\.opacity !== '0'/);
});
