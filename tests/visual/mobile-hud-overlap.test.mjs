import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const evidencePath = 'artifacts/evidence/mobile-hud-overlap-2026-10-08.json';
const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
const currentHead = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

test('mobile HUD safe-zone evidence covers every scene and required portrait viewports', () => {
  assert.doesNotThrow(() => execFileSync('git', ['merge-base', '--is-ancestor', evidence.sourceHead, currentHead]));
  assert.deepEqual(evidence.viewports.map(viewport => `${viewport.width}x${viewport.height}`), ['360x640', '390x844', '412x915']);
  assert.equal(evidence.summary.scenes, 66);
  assert.equal(evidence.summary.failures, 0);
  assert.ok(evidence.scenes.every(item => item.status === 'PASS'));
  assert.equal(new Set(evidence.scenes.map(item => item.scene)).size, 66);
});

test('S01 positions 2/9 and 3/9 keep character critical pixels outside HUD and reader sheet', () => {
  const targets = evidence.scenes.filter(item => item.scene === 'S01' && ['2/9', '3/9'].includes(item.displayedPosition));
  assert.equal(targets.length, 6);
  for (const item of targets) {
    assert.equal(item.measurement.overlaps.length, 0, `${item.displayedPosition} ${item.viewport.width}x${item.viewport.height}`);
    assert.equal(item.measurement.lowerOverlaps.length, 0, `${item.displayedPosition} lower sheet ${item.viewport.width}x${item.viewport.height}`);
    assert.equal(item.measurement.overflow, false);
  }
});
