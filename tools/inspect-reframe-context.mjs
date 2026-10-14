import { literarySeason } from '../src/literary-season-data.js';
import { compileInteractivePlayback } from '../src/literary-pacing.js';
import { visualAt } from '../src/literary-visual-directions.js';
import { stageForScene } from '../src/literary-stage.js';
for (const id of ['S04','S09','S13','S42']) {
  const scene = literarySeason.scenes.find(item => item.id === id);
  console.log(`--- ${id} ${scene.title}`);
  console.log(JSON.stringify(scene.chunks.slice(0, 3), null, 2));
}
for (const id of ['S04','S09','S13','S42']) {
  const scene = literarySeason.scenes.find(item => item.id === id);
  const choices = Object.fromEntries(literarySeason.scenes.flatMap(item => item.chunks.map(chunk => chunk.title.match(/(S\d{2}-C\d+)/)?.[1]).filter(Boolean)).map(key => [key,'A']));
  const flow = compileInteractivePlayback(scene, choices);
  console.log(`FLOW ${id}`);
  flow.forEach((entry,index) => {
    const direction = visualAt(id, entry, choices, stageForScene(id, choices).cast);
    if (index < 3 || direction.beatId !== 'scene-start') console.log(index, entry.id, entry.sourceStartRef, entry.sourceEndRef, direction.beatId, direction.cast, direction.requiredCast);
  });
}
