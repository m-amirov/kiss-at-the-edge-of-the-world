import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { literarySeason } from '../../src/literary-season-data.js';
import { compileScenePlayback, nextLiteraryScene, literarySaveKey } from '../../src/literary-engine.js';
import { compileLiterary } from '../../tools/literary/compile.mjs';

const scenes = new Map(literarySeason.scenes.map(scene => [scene.id,scene]));
const endings={A:'S44',B:'S45',C:'S46',D:'S47'};
const late=[...Array(22)].map((_,i)=>`S${String(i+27).padStart(2,'0')}`);
const tokenCount=text=>text.match(/[\p{L}\p{N}]+/gu)?.length??0;
function play({evening='A',route='A',crisis='A',future='A',lastDate='A',pick=()=> 'A'}={}){
 const choices={},seen=[],pages=[];let id='S01';
 while(id){
  assert.ok(scenes.has(id),`Unknown scene ${id}`);
  assert.ok(!seen.includes(id),`Cycle ${id}`);
  seen.push(id);
  let flow;
  for(let guard=0;guard<20;guard++){
   flow=compileScenePlayback(scenes.get(id),choices);
   const q=flow.at(-1);
   if(q?.type!=='choice')break;
   let option=q.id==='S17-C2'?evening:q.id==='S26-C1'?route:
      ['S32-C1','S33-C1','S34-C1'].includes(q.id)?crisis:
      ['S37-C1','S38-C1','S39-C1'].includes(q.id)?future:
      q.id==='S42-C1'?lastDate:pick(q.id,q.options);
   assert.ok(q.options.some(x=>x.code===option),`unavailable ${q.id}=${option}`);
   choices[q.id]=option;
  }
  assert.notEqual(flow.at(-1)?.type,'choice',`Stalled scene ${id}`);
  assert.ok(flow.some(x=>x.type==='paragraph'),`Empty prose ${id}`);
  pages.push(...flow.filter(x=>x.type==='paragraph').map(x=>({id,text:x.text})));
  id=nextLiteraryScene(id,choices);
  assert.ok(seen.length<=66,`Excessive path ${seen.length}`);
 }
 return {choices,seen,pages,words:tokenCount(pages.map(x=>x.text).join(' '))};
}
test('all 66 authored scenes compile deterministically into one ten-episode edition',()=>{
 assert.equal(literarySeason.episodes,10);
 assert.equal(literarySeason.scenes.length,66);
 assert.equal(scenes.size,66);
 assert.deepEqual(compileLiterary(),literarySeason);
 assert.deepEqual(Object.values(literarySeason.sceneOrder).map(x=>x.length),[5,5,4,4,6,6,10,8,10,8]);
});
test('all sixteen evening / route-lock combinations reach their route-specific final scene',()=>{
 for(const evening of 'ABCD')for(const route of 'ABCD'){
  const result=play({evening,route});
  const evenings=['S18','S19','S20','S21','S61'];
  const selected={A:['S18'],B:['S19'],C:['S20'],D:['S21','S61']}[evening];
  assert.deepEqual(result.seen.filter(id=>evenings.includes(id)),selected);
  assert.equal(result.seen.at(-1),endings[route]);
  assert.equal(result.seen.filter(id=>['S44','S45','S46','S47'].includes(id)).length,1);
  assert.equal(result.seen.filter(id=>['S28','S29','S30','S31'].includes(id)).length,1);
  assert.equal(result.seen.filter(id=>['S37','S38','S39','S40'].includes(id)).length,1);
  assert.ok(result.words>20000,`Path too short to be fully loaded ${evening}${route}: ${result.words}`);
  assert.ok(result.seen.indexOf('S48')<result.seen.indexOf(endings[route]),'group farewell must precede one-month epilogue');
 }
});
test('close, pause and refusal are explicit; closed routes never return to romance',()=>{
 for(const route of 'ABC'){
  const end=play({route,crisis:'C'});
  assert.equal(end.seen.at(-1),'S47');
  assert.ok(end.seen.includes('S35')&&end.seen.includes('S63'));
  assert.equal(end.seen.includes('S42'),false);
  const later=play({route,future:'B'});
  assert.equal(later.seen.at(-1),'S47');
  assert.equal(later.seen.includes('S42'),false);
  const declined=play({route,lastDate:'B'});
  assert.equal(declined.seen.at(-1),'S47');
  assert.ok(declined.seen.includes('S43'));
  const paused=play({route,crisis:'B',future:'A'});
  assert.equal(paused.seen.at(-1),endings[route]);
 }
});
test('conditional prose never leaks the other partner, career paragraph or ending',()=>{
 for(const [code,partner] of Object.entries({A:'Эрик',B:'Ник',C:'Дамир'})){
  const flow=compileScenePlayback(scenes.get('S42'),{'S26-C1':code,'S42-C1':'A'});
  const first=flow[0].text;
  assert.ok(first.startsWith(partner),`Wrong partner in S42 for ${code}`);
  assert.equal(flow.filter(x=>x.type==='choice').length,0);
 }
 const alice=compileScenePlayback(scenes.get('S48'),{'S26-C1':'D'}).map(x=>x.text||'').join(' ');
 assert.doesNotMatch(alice,/коня по имени Шум|бумажную закладку/);
 const scene=compileScenePlayback(scenes.get('S41'),{'S26-C1':'D','S02-C1':'A','S41-C1':'A'}).map(x=>x.text||'').join(' ');
 assert.ok(scene.includes('Ингина фотография настила'));
 assert.ok(!scene.includes('вид дороги после дождя'));
});
test('late route payoff depends on early decisions without opening another romance',()=>{
 const original=play({evening:'D',route:'B',pick:(id,opts)=>id==='S04-C1'?'B':opts[0].code});
 assert.ok(original.seen.includes('S29'));
 assert.ok(!original.seen.includes('S28')&&!original.seen.includes('S30'));
 assert.equal(original.choices['S26-C1'],'B');
 const eric=play({evening:'B',route:'A'});
 assert.ok(eric.seen.includes('S28'));
 assert.ok(eric.seen.includes('S44'));
 assert.ok(!eric.seen.includes('S45'));
});
test('S18 approved lines survive the transport; old and new saves are isolated',()=>{
 const text=compileScenePlayback(scenes.get('S18'),{'S17-C2':'A','S18-C1':'A'}).map(x=>x.text||'').join(' ');
 for(const phrase of ['Хотя последние годы «домой» каждый раз оказывалось другим адресом','Уже минут двадцать не могу','Только не как пункт маршрута'])assert.ok(text.includes(phrase));
 assert.notEqual(literarySaveKey,'kiss-at-the-edge-of-the-world:season-1:v4');
 const player=fs.readFileSync(new URL('../../src/literary-player.js',import.meta.url),'utf8');
 assert.match(player,/localStorage\.setItem\(literarySaveKey/);
 assert.match(player,/literaryCloudKey/);
 assert.match(player,/cloudLocked/);
 assert.doesNotMatch(player,/SAVE_KEY|LEGACY_SAVE_KEY/);
});
test('300 synthetic complete paths preserve all branch and ending invariants',()=>{
 const samples=[];
 for(let n=0;n<300;n++){
  const evening='ABCD'[n%4],route='ABCD'[Math.floor(n/4)%4];
  const crisis=['A','B','C'][Math.floor(n/16)%3];
  const future=['A','B'][Math.floor(n/48)%2];
  const lastDate=['A','B','C'][Math.floor(n/96)%3];
  const result=play({evening,route,crisis,future,lastDate,pick:(id,opts)=>opts[(n+id.length)%opts.length].code});
  samples.push(result.words);
  assert.equal(result.seen.filter(id=>['S18','S19','S20','S21'].includes(id)).length,1);
  assert.equal(result.seen.filter(id=>['S44','S45','S46','S47'].includes(id)).length,1);
  assert.equal(result.seen.at(-2),'S48');
  assert.ok(result.words>18000);
 }
 assert.equal(samples.length,300);
});
