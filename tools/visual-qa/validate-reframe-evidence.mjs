import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { literarySeason } from '../../src/literary-season-data.js';
import { compileInteractivePlayback } from '../../src/literary-pacing.js';
import { visualAt } from '../../src/literary-visual-directions.js';
import { stageForScene, stageCastForPresentation } from '../../src/literary-stage.js';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const evidenceDir = path.resolve(process.env.REFRAME_BATCH1_OUTPUT ?? path.join(root, 'artifacts/evidence/reframe-batch1-2026-10-08'));
const targets = [
  ['S04', 'scene-start'], ['S04', 'thingvellir-trail'],
  ['S09', 'scene-start'], ['S09', 'skogafoss-trail'],
  ['S13', 'scene-start'], ['S13', 'skaftafell-parking'],
  ['S36', 'scene-start'], ['S36', 'snaefellsnes-drive']
];
const allChoices = Object.fromEntries(literarySeason.scenes.flatMap(scene => scene.chunks.map(chunk => chunk.title.match(/(S\d{2}-C\d+)/)?.[1]).filter(Boolean)).map(id => [id, 'A']));
const sceneById = id => literarySeason.scenes.find(scene => scene.id === id);
const flowFor = id => compileInteractivePlayback(sceneById(id), allChoices, 'ru');
const beatAt = (id, position) => visualAt(id, flowFor(id)[position], allChoices, stageForScene(id, allChoices).cast);
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
      const expectedCast = phase === 'after' ? stageCastForPresentation(expected).length : Math.min(expected.cast.length, 2);
      if (capture.readback.stageCount !== expectedCast) failures.push(`${phase}:${id}:${capture.label}:cast=${capture.readback.stageCount},expected=${expectedCast}`);
    }
  }
}

const result = { status: failures.length ? 'FAIL' : 'PASS', sourceHead: process.env.GIT_HEAD ?? '7181c60e3e0236befe915f43e45e90241db78b32', phases, failures };
await fs.writeFile(path.join(evidenceDir, 'validated-evidence.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exitCode = 1;
