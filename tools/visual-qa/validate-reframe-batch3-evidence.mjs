import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { literarySeason } from '../../src/literary-season-data.js';
import { compileInteractivePlayback } from '../../src/literary-pacing.js';
import { visualAt } from '../../src/literary-visual-directions.js';
import { stageForScene, stageCastForPresentation } from '../../src/literary-stage.js';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const evidenceDir = path.resolve(process.env.REFRAME_BATCH3_OUTPUT ?? path.join(root, 'artifacts/evidence/reframe-batch3-2026-10-08'));
const targets = [
  ['S46', 'airport-bus', null], ['S42', 's42-harbour-cafe', 'A'], ['S42', 's42-harbour-cafe', 'B'], ['S42', 's42-harbour-cafe', 'C'],
  ['S01', 'nick-arrives', null], ['S18', 'scene-start', null], ['S28', 'scene-start', null], ['S30', 'scene-start', null]
];
const allChoices = {'S04-C1':'A','S05-C1':'A','S13-C1':'A','S15-C1':'A','S17-C2':'A','S22-C1':'A','S26-C1':'A'};
const sceneById = id => literarySeason.scenes.find(scene => scene.id === id);
const choicesFor = route => ({ ...allChoices, ...(route ? { 'S26-C1': route } : {}) });
const flowFor = (id, route) => compileInteractivePlayback(sceneById(id), choicesFor(route), 'ru');
const beatAt = (id, route, position) => visualAt(id, flowFor(id, route)[position], choicesFor(route), stageForScene(id, choicesFor(route)).cast);
const failures = [];
const phases = {};
for (const phase of ['before', 'after']) {
  const evidence = JSON.parse(await fs.readFile(path.join(evidenceDir, `evidence-${phase}.json`), 'utf8'));
  phases[phase] = { targets: evidence.targets.length, captures: 0 };
  for (const [sceneId, beatId, route] of targets) {
    const id = route ? `${sceneId}-scene-start-${route}` : `${sceneId}-${beatId}`;
    const target = evidence.targets.find(item => item.id === id);
    if (!target) { failures.push(`${phase}:${id}:missing-target`); continue; }
    const flow = flowFor(sceneId, route);
    const targetPosition = flow.findIndex((_, position) => beatAt(sceneId, route, position).beatId === beatId);
    const expectedPositions = { previous: Math.max(0, targetPosition - 1), target: targetPosition, next: Math.min(flow.length - 1, targetPosition + 1) };
    for (const capture of target.captures) {
      phases[phase].captures += 1;
      const expectedPosition = expectedPositions[capture.label];
      const expected = beatAt(sceneId, route, expectedPosition);
      if (capture.position !== expectedPosition || capture.readback.cue !== expected.beatId) failures.push(`${phase}:${id}:${capture.label}:cue=${capture.readback.cue},expected=${expected.beatId}`);
      if (capture.readback.overflow || capture.readback.internalScroll || !capture.readback.edgeToEdge || !capture.readback.imagesReady || capture.consoleErrors.length || capture.failedRequests.length || capture.notFound.length) failures.push(`${phase}:${id}:${capture.label}:runtime-health`);
      const [viewportWidth, viewportHeight] = capture.readback.viewport;
      const picture = capture.readback.pictureRect;
      if (!picture || picture.left !== 0 || picture.top !== 0 || Math.abs(picture.width - viewportWidth) > 1 || Math.abs(picture.height - viewportHeight) > 1) failures.push(`${phase}:${id}:${capture.label}:edge-to-edge`);
      const expectedCast = expected.art?.type === 'cg' ? 0 : (phase === 'after' ? stageCastForPresentation(expected).length : Math.min(expected.cast.length, 2));
      if (capture.readback.stageCount !== expectedCast) failures.push(`${phase}:${id}:${capture.label}:cast=${capture.readback.stageCount},expected=${expectedCast}`);
      if (phase === 'after' && capture.label === 'target' && expected.art?.type !== 'cg' && !capture.readback.stageLayout?.startsWith('batch3-')) failures.push(`${phase}:${id}:missing-batch3-layout`);
    }
  }
}
const result = { status: failures.length ? 'FAIL' : 'PASS', sourceHead: process.env.GIT_HEAD ?? null, phases, failures };
await fs.writeFile(path.join(evidenceDir, 'validated-evidence.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exitCode = 1;
