import test from 'node:test';
import assert from 'node:assert/strict';
import {literarySeason} from '../../src/literary-season-data.js';
import {compileScenePlayback,nextLiteraryScene,conditional} from '../../src/literary-engine.js';

const scenes=new Map(literarySeason.scenes.map(s=>[s.id,s]));
const early=Object.fromEntries(['S01-C1','S02-C1','S04-C1','S05-C1','S08-C1','S09-C1','S13-C1','S15-C1','S16-C1','S17-C2','S18-C1','S19-C2','S20-C1','S21-C1','S23-C1','S26-C1'].map(id=>[id,'A']));
const extra={
 S03:['C1','S04'],S18:['C2','S23'],S19:['C3','S24'],S20:['C2','S25'],S21:['C2','S61'],S50:['C2','S37'],S53:['C2','S38'],S56:['C2','S39'],S63:['C2','S40'],S06:['C2','S07'],S12:['C3','S13'],S14:['C2','S15'],S22:['C2','S23'],
 S28:['C2','S49'],S29:['C2','S52'],S30:['C2','S55'],S31:['C2','S62'],
 S37:['C2','S51'],S38:['C2','S54'],S39:['C2','S57'],S40:['C2','S64'],S41:['C2','S48']
};
function finishScene(sceneId,choices,select=()=> 'A'){
 const scene=scenes.get(sceneId);let flow=[];
 for(let guard=0;guard<20;guard++){
  flow=compileScenePlayback(scene,choices);
  const q=flow.at(-1);
  if(q?.type!=='choice')return flow;
  const selected=select(q.id,q.options);
  assert.ok(q.options.some(o=>o.code===selected),`missing ${q.id}=${selected}`);
  choices[q.id]=selected;
 }
 throw new Error(`Choice loop in ${sceneId}`);
}
test('new reader decisions have authored A/B alternatives and exclusive later payoffs',()=>{
 for(const [sceneId,[suffix,echoId]] of Object.entries(extra)){
  const choiceId=`${sceneId}-${suffix}`;
  const scene=scenes.get(sceneId);
  assert.ok(scene.chunks.some(c=>c.title.startsWith(`Выбор ${choiceId}`)),choiceId);
  const forA=finishScene(sceneId,{...early},(id)=>id===choiceId?'A':'A');
  const forB=finishScene(sceneId,{...early},(id)=>id===choiceId?'B':'A');
  const textA=forA.filter(e=>e.type==='paragraph').map(e=>e.text).join(' ');
  const textB=forB.filter(e=>e.type==='paragraph').map(e=>e.text).join(' ');
  assert.notEqual(textA,textB,`no alternative literary consequence ${choiceId}`);
  assert.equal(conditional(echoId,`Если \`${choiceId}=A\``,{[choiceId]:'A'}),true);
  assert.equal(conditional(echoId,`Если \`${choiceId}=B\``,{[choiceId]:'A'}),false);
  assert.equal(conditional(echoId,`Если \`${choiceId}=B\``,{[choiceId]:'B'}),true);
  const echoes=scenes.get(echoId).chunks.filter(c=>c.title.startsWith(`Если \`${choiceId}=`));
  assert.deepEqual(echoes.map(c=>c.title),[`Если \`${choiceId}=A\``,`Если \`${choiceId}=B\``]);
  assert.ok(echoes.every(c=>c.paragraphs.join(' ').length>30));
 }
});
test('the four playable routes each expose at least 47 decisions without mixing endings',()=>{
 for(const route of 'ABCD'){
  let id='S01',choices={},count=0;let guard=0;
  while(id){
   const flow=finishScene(id,choices,qid=>qid==='S26-C1'?route:'A');
   count=Object.keys(choices).length;
   id=nextLiteraryScene(id,choices);
   if(++guard>66)throw new Error(`Cyclic route ${route}`);
  }
  assert.ok(count>=47,`${route}: only ${count} choices`);
  assert.equal(choices['S26-C1'],route);
 }
});
