import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { literarySeason } from '../../src/literary-season-data.js';
import { compileInteractivePlayback } from '../../src/literary-pacing.js';
import { visualAt } from '../../src/literary-visual-directions.js';
import { stageForScene, stageCastForPresentation } from '../../src/literary-stage.js';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const evidenceDir = path.resolve(process.env.REFRAME_BATCH2_OUTPUT ?? path.join(root, 'artifacts/evidence/reframe-batch2-2026-10-08'));
const targets = [
  ['S05', 'scene-start'], ['S07', 'scene-start'], ['S11', 'scene-start'], ['S16', 'scene-start'],
  ['S22', 'scene-start'], ['S58', 'scene-start'], ['S15', 'scene-start'], ['S15', 'jokulsarlon-lagoon']
];
const choices = {'S04-C1':'A','S05-C1':'A','S13-C1':'A','S15-C1':'A','S17-C2':'A','S22-C1':'A','S26-C1':'A'};
const sceneById = id => literarySeason.scenes.find(scene => scene.id === id);
const flowFor = id => compileInteractivePlayback(sceneById(id), choices, 'ru');
const beatAt = (id, position) => visualAt(id, flowFor(id)[position], choices, stageForScene(id, choices).cast);
const phases = {};
const failures = [];

for (const phase of ['before', 'after']) {
  const evidence = JSON.parse(await fs.readFile(path.join(evidenceDir, `evidence-${phase}.json`), 'utf8'));
  phases[phase] = { targets: evidence.targets.length, captures: 0 };
  for (const [sceneId, beatId] of targets) {
    const id = `${sceneId}-${beatId}`;
    const target = evidence.targets.find(item => item.id === id);
    if (!target) { failures.push(`${phase}:${id}:missing-target`); continue; }
    const flow = flowFor(sceneId);
    const targetPosition = flow.findIndex((_, position) => beatAt(sceneId, position).beatId === beatId);
    const expectedPositions = { previous: Math.max(0, targetPosition - 1), target: targetPosition, next: Math.min(flow.length - 1, targetPosition + 1) };
    for (const capture of target.captures) {
      phases[phase].captures += 1;
      const expectedPosition = expectedPositions[capture.label];
      const expected = beatAt(sceneId, expectedPosition);
      if (capture.position !== expectedPosition || capture.readback.cue !== expected.beatId) failures.push(`${phase}:${id}:${capture.label}:cue=${capture.readback.cue},expected=${expected.beatId}`);
      if (capture.readback.overflow || capture.readback.internalScroll || !capture.readback.imagesReady || capture.consoleErrors.length || capture.failedRequests.length || capture.notFound.length) failures.push(`${phase}:${id}:${capture.label}:runtime-health`);
      const [viewportWidth, viewportHeight] = capture.readback.viewport;
      const picture = capture.readback.pictureRect;
      if (!picture || picture.left !== 0 || picture.top !== 0 || Math.abs(picture.width - viewportWidth) > 1 || Math.abs(picture.height - viewportHeight) > 1) failures.push(`${phase}:${id}:${capture.label}:edge-to-edge`);
      const expectedCast = expected.art?.type === 'cg' ? 0 : (phase === 'after' ? stageCastForPresentation(expected).length : Math.min(expected.cast.length, 2));
      if (capture.readback.stageCount !== expectedCast) failures.push(`${phase}:${id}:${capture.label}:cast=${capture.readback.stageCount},expected=${expectedCast}`);
      if (phase === 'after' && capture.label === 'target' && !capture.readback.stageLayout?.startsWith('batch2-')) failures.push(`${phase}:${id}:missing-batch2-layout`);
    }
  }
}

const result = { status: failures.length ? 'FAIL' : 'PASS', sourceHead: process.env.GIT_HEAD ?? 'b7163bc9ac00f750e5e716b80928feccbf7e797f', phases, failures };
await fs.writeFile(path.join(evidenceDir, 'validated-evidence.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exitCode = 1;
