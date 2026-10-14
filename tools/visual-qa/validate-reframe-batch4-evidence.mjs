import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { literarySeason } from '../../src/literary-season-data.js';
import { compileInteractivePlayback } from '../../src/literary-pacing.js';
import { visualAt } from '../../src/literary-visual-directions.js';
import { stageForScene, stageCastForPresentation } from '../../src/literary-stage.js';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const group = process.env.REFRAME_BATCH4_GROUP ?? 'group1';
const evidenceDir = path.resolve(process.env.REFRAME_BATCH4_OUTPUT ?? path.join(root, `artifacts/evidence/reframe-batch4-2026-10-08/${group}`));
const targets = {
  group1: [['S33', 'scene-start'], ['S34', 'scene-start'], ['S37', 'scene-start'], ['S49', 'scene-start'], ['S50', 'scene-start']],
  group2: [['S52', 'scene-start'], ['S55', 'scene-start'], ['S03', 'editor-call'], ['S35', 'scene-start'], ['S41', 'editor-cafe-call']]
}[group];
const allChoices = Object.fromEntries(literarySeason.scenes.flatMap(scene => scene.chunks.map(chunk => chunk.title.match(/(S\d{2}-C\d+)/)?.[1]).filter(Boolean)).map(id => [id, 'A']));
const sceneById = id => literarySeason.scenes.find(scene => scene.id === id);
const flowFor = id => compileInteractivePlayback(sceneById(id), allChoices, 'ru');
const beatAt = (id, position) => visualAt(id, flowFor(id)[position], allChoices, stageForScene(id, allChoices).cast);
const failures = [], phases = {};
for (const phase of ['before', 'after']) {
  const evidence = JSON.parse(await fs.readFile(path.join(evidenceDir, `evidence-${phase}.json`), 'utf8'));
  phases[phase] = { targets: evidence.targets.length, captures: 0 };
  for (const [sceneId, beatId] of targets) {
    const id = `${sceneId}-${beatId}`;
    const target = evidence.targets.find(item => item.id === id);
    if (!target) { failures.push(`${phase}:${id}:missing-target`); continue; }
    const flow = flowFor(sceneId);
    const targetPosition = flow.findIndex((_, position) => beatAt(sceneId, position).beatId === beatId);
    if (targetPosition < 0) { failures.push(`${phase}:${id}:missing-source-beat`); continue; }
    const expectedPositions = { previous: Math.max(0, targetPosition - 1), target: targetPosition, next: Math.min(flow.length - 1, targetPosition + 1) };
    for (const capture of target.captures) {
      phases[phase].captures += 1;
      const expectedPosition = expectedPositions[capture.label];
      const expected = beatAt(sceneId, expectedPosition);
      if (capture.position !== expectedPosition || capture.readback.cue !== expected.beatId) failures.push(`${phase}:${id}:${capture.label}:cue=${capture.readback.cue},expected=${expected.beatId}`);
      if (capture.readback.overflow || capture.readback.internalScroll || !capture.readback.edgeToEdge || !capture.readback.imagesReady || capture.consoleErrors.length || capture.failedRequests.length || capture.notFound.length) failures.push(`${phase}:${id}:${capture.label}:runtime-health`);
      const expectedCast = expected.art?.type === 'cg' ? 0 : stageCastForPresentation(expected).length;
      if (capture.readback.stageCount !== expectedCast) failures.push(`${phase}:${id}:${capture.label}:cast=${capture.readback.stageCount},expected=${expectedCast}`);
      if (phase === 'after' && capture.label === 'target' && expected.art?.type !== 'cg' && !capture.readback.stageLayout?.startsWith('batch4-')) failures.push(`${phase}:${id}:missing-batch4-layout`);
    }
  }
}
const result = { status: failures.length ? 'FAIL' : 'PASS', sourceHead: process.env.GIT_HEAD ?? null, group, phases, failures };
await fs.writeFile(path.join(evidenceDir, 'validated-evidence.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exitCode = 1;
