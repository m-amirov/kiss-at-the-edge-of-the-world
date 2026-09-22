import test from 'node:test';
import assert from 'node:assert/strict';
import {literarySeason} from '../../src/literary-season-data.js';
import {compileScenePlayback,nextLiteraryScene} from '../../src/literary-engine.js';
import {compileInteractivePlayback} from '../../src/literary-pacing.js';
import {interactionBeats,interactionEchoes} from '../../src/literary-interactive-beats.js';
const scenes=new Map(literarySeason.scenes.map(s=>[s.id,s]));
const seeded=Object.fromEntries(literarySeason.scenes.flatMap(s=>s.chunks.map(c=>c.title.match(/Выбор (S\d+-C\d+)/)?.[1]).filter(Boolean)).map(id=>[id,'A']));

function complete(route='A',evening='A',answer='A'){
 let sceneId='S01',choices={},visits=[],perEpisode=Array(10).fill(0),screens=0;
 while(sceneId){
  const s=scenes.get(sceneId);assert.ok(s);visits.push(sceneId);
  for(let guard=0;guard<20;guard++){
   const flow=compileInteractivePlayback(s,choices);
   const question=flow.at(-1);
   if(question?.type!=='choice'){
    const original=compileScenePlayback(s,choices);
    assert.deepEqual(flow.filter(e=>e.type==='page'&&!e.decisionResult&&!e.echoOf).flatMap(e=>e.paragraphs),
      original.filter(e=>e.type==='paragraph').map(e=>e.text),`manuscript text lost in ${sceneId}`);
    screens+=flow.length;break;
   }
   const selected=question.id==='S26-C1'?route:question.id==='S17-C2'?evening:answer;
   assert.ok(question.options.some(o=>o.code===selected),`${question.id}: option ${selected} missing`);
   assert.ok(!Object.hasOwn(choices,question.id),`repeated question ${question.id}`);
   choices[question.id]=selected;perEpisode[s.episode-1]++;
   if(guard===19)assert.fail(`unresolved loop in ${sceneId}`);
  }
  sceneId=nextLiteraryScene(sceneId,choices);
  assert.ok(visits.length<=66);
 }
 return {choices,visits,perEpisode,screens};
}
test('all 66 scenes contain a unique authored, nonempty actionable interaction',()=>{
 assert.deepEqual(Object.keys(interactionBeats).sort(),[...scenes.keys()].sort());
 for(const [sceneId,beats]of Object.entries(interactionBeats)){
  assert.equal(beats.length,scenes.get(sceneId).episode<=6?2:1,`${sceneId} cadence`);
  for(const [index,beat] of beats.entries()){
   assert.ok(beat.question.length>18,`${sceneId} prompt ${index}`);
   assert.equal(beat.options.length,2);
   assert.deepEqual(beat.options.map(o=>o.code),['A','B']);
   assert.ok(beat.options.every(o=>o.label.length>10&&o.text.length>45),`${sceneId} reaction ${index}`);
   assert.notEqual(beat.options[0].text,beat.options[1].text);
   const native=compileScenePlayback(scenes.get(sceneId),seeded).filter(o=>o.type==='choice');
   assert.ok(!native.some(o=>o.id===`${sceneId}-C${90+index}`));
  }
 }
});
test('four playable routes expose 113–116 decisions per path without deleting manuscript',()=>{
 for(const route of 'ABCD')for(const evening of 'ABCD'){
  const result=complete(route,evening);
  assert.equal(result.visits.length,evening==='D'?41:40);
  assert.equal(Object.keys(result.choices).length,{A:113,B:114,C:113,D:116}[evening],`${evening}/${route}`);
  assert.equal(Object.keys(result.choices).filter(x=>/-C9[01]$/.test(x)).length,evening==='D'?68:66);
  assert.equal(result.visits.at(-1),{A:'S44',B:'S45',C:'S46',D:'S47'}[route]);
  assert.ok(result.perEpisode.every(x=>x>=5),`${route} episode cadence: ${result.perEpisode}`);
 }
});
test('B decisions remain independently reachable, save-safe and branch-specific',()=>{
 for(const route of 'ABCD'){
  const b=complete(route,'D','B');
  assert.ok(Object.keys(b.choices).length>=113);
  for(const [id,answer]of Object.entries(b.choices))if(/-C9[01]$/.test(id))assert.equal(answer,'B');
 }
 for(const [sceneId,echoes]of Object.entries(interactionEchoes))for(const [choiceId,a,b]of echoes){
  assert.ok(scenes.has(sceneId));assert.ok(/-C9[01]$/.test(choiceId));assert.ok(a.length>30&&b.length>30&&a!==b);
  const chooseA=compileInteractivePlayback(scenes.get(sceneId),{...seeded,[choiceId]:'A'}).map(e=>e.text||'').join(' ');
  const chooseB=compileInteractivePlayback(scenes.get(sceneId),{...seeded,[choiceId]:'B'}).map(e=>e.text||'').join(' ');
  assert.ok(chooseA.includes(a)&&!chooseA.includes(b),`${sceneId}/${choiceId} A payoff`);
  assert.ok(chooseB.includes(b)&&!chooseB.includes(a),`${sceneId}/${choiceId} B payoff`);
 }
});
test('a choice is a stable page boundary and selected reaction occupies its former index',()=>{
 for(const scene of literarySeason.scenes){
  const first=compileInteractivePlayback(scene,seeded).at(-1);
  if(first?.type!=='choice')continue;
  const before=compileInteractivePlayback(scene,seeded);
  const after=compileInteractivePlayback(scene,{...seeded,[first.id]:'A'});
  assert.equal(before.at(-1).id,first.id);
  assert.ok(after.length>=before.length);
  assert.equal(after[before.length-1]?.type,'page',`next after ${first.id} should be readable without jumping`);
 }
});
