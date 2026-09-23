import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {literarySeason} from '../../src/literary-season-data.js';
import {compileInteractivePlayback} from '../../src/literary-pacing.js';
import {stageForScene} from '../../src/literary-stage.js';
import {visualScenes,visualCues,visualAt,visualEntryForPosition} from '../../src/literary-visual-directions.js';

const scenes=new Map(literarySeason.scenes.map(s=>[s.id,s]));
function complete(id,choiceOverrides={}){
 const seed=['S01-C1','S02-C1','S04-C1','S05-C1','S08-C1','S09-C1','S13-C1','S15-C1','S16-C1','S17-C2','S18-C1','S19-C2','S20-C1','S21-C1','S23-C1','S26-C1','S32-C1','S33-C1','S34-C1','S37-C1','S38-C1','S39-C1','S42-C1'];
 const everyChoice=literarySeason.scenes.flatMap(s=>s.chunks.map(c=>c.title.match(/Выбор\s+(S\d{2}-C\d+)/)?.[1]).filter(Boolean));
 const choices={...Object.fromEntries([...seed,...everyChoice].map(id=>[id,'A'])),...choiceOverrides};let flow=[];
 for(let i=0;i<100;i++){
  flow=compileInteractivePlayback(scenes.get(id),choices);
  const pending=flow.find(e=>e.type==='choice');
  if(!pending)return {flow,choices};
  choices[pending.id] ??= pending.options[0].code;
 }
 throw new Error(`Unresolved ${id}`);
}
function shot(id,flow,position,choices){
 return visualAt(id,flow[position],choices,stageForScene(id,choices).cast);
}
function indexOfSource(flow,chunk,paragraph){
 const i=flow.findIndex(e=>e.sourceStartRef?.chunk===chunk && e.sourceStartRef.paragraph===paragraph);
 assert.ok(i>=0,`Missing source ${chunk}:${paragraph}`);return i;
}
test('all 66 scenes have a real authored place, time, cast and bounded image reference',()=>{
 assert.deepEqual(new Set(Object.keys(visualScenes)),new Set(scenes.keys()));
 for(const [id,scene] of scenes){
  const {flow,choices}=complete(id,{'S17-C2':'A','S26-C1':'A','S18-C1':'A'});
  assert.ok(flow.length,id);
  for(const [i,entry] of flow.entries()){
   const d=shot(id,flow,i,choices);
   assert.ok(d.location&&d.time&&d.beatId,`${id} missing visual metadata`);
   assert.ok(d.cast.length&&new Set(d.cast).size===d.cast.length,`${id} invalid cast`);
   if(d.art){
    const file=new URL(`../../assets/${d.art.type==='cg'?'cg':'backgrounds'}/${d.art.file}`,import.meta.url);
    assert.ok(fs.existsSync(file),`${id}/${d.beatId}: missing ${d.art.file}`);
   }
  }
  for(const cue of visualCues[id]||[]){
   assert.ok(scene.chunks[cue.at[0]]?.paragraphs[cue.at[1]],`${id}/${cue.id} dangling event address`);
   const ref={chunk:cue.at[0],paragraph:cue.at[1]};
   assert.ok(shot(id,[{sourceStartRef:ref,sourceEndRef:ref}],0,choices).beatId,`${id} cue unresolved`);
  }
 }
});

test('S02 cafe background appears only after arrival and never during the road sequence',()=>{
 const {flow,choices}=complete('S02');
 assert.equal(shot('S02',flow,0,choices).location,'Автомобиль по дороге в Рейкьявик');
 assert.equal(shot('S02',flow,0,choices).art,null);
 const cafe=indexOfSource(flow,0,31);
 assert.equal(shot('S02',flow,cafe,choices).beatId,'roadside-cafe');
 assert.equal(shot('S02',flow,cafe,choices).art?.file,'s02-roadside-cafe.png');
 assert.equal(shot('S02',flow,cafe,choices).art?.type,'background');
 assert.equal(shot('S02',flow,cafe-1,choices).art,null);
 assert.ok(flow.every((e,i)=>shot('S02',flow,i,choices).art?.type!=='cg'));
});

test('S66 greenhouse uses the authored environment and its independent portrait mapping',()=>{
 const {flow,choices}=complete('S66');
 const opening=shot('S66',flow,0,choices);
 assert.equal(opening.art?.type,'background');
 assert.equal(opening.art?.file,'s66-hveragerdi-greenhouse.png');
 assert.ok(fs.existsSync(new URL('../../assets/backgrounds/s66-hveragerdi-greenhouse.png',import.meta.url)));
 assert.ok(fs.existsSync(new URL('../../assets/backgrounds/s66-hveragerdi-greenhouse-portrait.png',import.meta.url)));
});

test('S05 Hveragerði road uses the authored desktop background and independent portrait mapping',()=>{
 const {flow,choices}=complete('S05');
 const opening=shot('S05',flow,0,choices);
 assert.equal(opening.art?.file,'s05-hveragerdi-road.png');
 assert.ok(fs.existsSync(new URL('../../assets/backgrounds/s05-hveragerdi-road.png',import.meta.url)));
 assert.ok(fs.existsSync(new URL('../../assets/backgrounds/s05-hveragerdi-road-portrait.png',import.meta.url)));
});

test('S13 visitor center precedes notebook CG; image is not used in Vik',()=>{
 const {flow,choices}=complete('S13');
 const arrival=indexOfSource(flow,0,7),notebook=indexOfSource(flow,0,12);
 assert.equal(shot('S13',flow,0,choices).art,null);
 assert.equal(shot('S13',flow,arrival,choices).art,null);
 assert.equal(shot('S13',flow,notebook,choices).art?.file,'s13-skaftafell-travelers.png');
 assert.ok(arrival<notebook);
});

test('S18 dance happens before the kiss choice on all options; walking back and morning end it',()=>{
 for(const option of ['A','B','C']){
  const {flow,choices}=complete('S18',{'S17-C2':'A','S18-C1':option});
  const dance=indexOfSource(flow,0,35),walk=indexOfSource(flow,0,39),morning=indexOfSource(flow,5,1),breakfast=indexOfSource(flow,5,3);
  assert.equal(shot('S18',flow,dance,choices).art?.file,'s18-hofn-dance-lights.png');
  assert.equal(shot('S18',flow,walk,choices).art?.type,'background');
  assert.equal(shot('S18',flow,morning,choices).art,null);
  assert.deepEqual(shot('S18',flow,breakfast,choices).cast,['alice','eric','nick','damir']);
  assert.ok(dance<walk&&walk<morning&&morning<breakfast);
 }
});

test('finale location and art change at the literal month-later epilogue for all four routes',()=>{
 const cfg={S44:['s44-eric-epilogue-month-later.png',4],S45:['s45-nick-home-epilogue-month-later.png',4],S46:['s46-damir-epilogue-month-later.png',4],S47:['s47-alice-home-epilogue-month-later.png',4]};
 for(const [id,[expectedCG,chapter]] of Object.entries(cfg)){
  const {flow,choices}=complete(id);
  const first=shot(id,flow,0,choices);
  if(id==='S45')assert.equal(first.art?.file,'s45-reykjavik-warm-montage.png');
  if(id==='S46')assert.equal(first.art,null);
  if(id==='S47')assert.equal(first.art?.file,'s47-reykjavik-harbour-alice.png');
  if(id==='S46'){
   assert.equal(first.art,null);
   assert.equal(shot(id,flow,indexOfSource(flow,0,1),choices).art?.file,'s46-airport-goodbye.png');
  }
  const month=indexOfSource(flow,chapter,0);
  const final=shot(id,flow,month,choices);
  assert.equal(final.time,'спустя месяц',id);
  if(final.beatId==='damir-month-later' || id!=='S46')assert.equal(final.art?.file,expectedCG,`missing month-later CG in ${id} epilogue`);
  assert.ok(month>0);
 }
});

test('the page boundary never mixes different authored visual beats',()=>{
 for(const id of ['S01','S02','S13','S18','S26','S44','S45','S46','S47']){
  const {flow,choices}=complete(id,{'S18-C1':'A','S26-C1':'A','S17-C2':'A'});
  for(const page of flow.filter(e=>e.type==='page'&&e.sourceStartRef&&e.sourceEndRef)){
   const a=visualAt(id,{sourceEndRef:page.sourceStartRef},choices,stageForScene(id,choices).cast);
   const b=visualAt(id,{sourceEndRef:page.sourceEndRef},choices,stageForScene(id,choices).cast);
   assert.equal(a.beatId,b.beatId,`${id}: page spans two visual beats`);
  }
 }
});

test('S26 Eric CG appears only at the authored consensual embrace and stays isolated',()=>{
 for(const route of ['A','B','C','D']){
  const {flow,choices}=complete('S26',{'S26-C90':'A','S26-C1':route});
  const routeChunk={A:2,B:8,C:14,D:20}[route];
  const routeAt=indexOfSource(flow,routeChunk,0);
  const embraceAt=route==='A'?indexOfSource(flow,7,0):routeAt;
  assert.notEqual(shot('S26',flow,routeAt,choices).art?.file,'s26-eric-choice.png');
  if(route==='A') assert.equal(shot('S26',flow,embraceAt,choices).art?.file,'s26-eric-choice.png');
  else assert.notEqual(shot('S26',flow,embraceAt,choices).art?.file,'s26-eric-choice.png');
 }
});

test('S02 and S26 visual state survives a save/load-shaped choice round trip',()=>{
 const s02=complete('S02');
 const s02Saved=JSON.parse(JSON.stringify(s02.choices));
 const s02Cafe=indexOfSource(s02.flow,0,31);
 assert.equal(shot('S02',s02.flow,s02Cafe,s02Saved).art?.file,'s02-roadside-cafe.png');
 const s26=complete('S26',{'S26-C90':'A','S26-C1':'A'});
 const s26Saved=JSON.parse(JSON.stringify(s26.choices));
 const s26Eric=indexOfSource(s26.flow,7,0);
 assert.equal(shot('S26',s26.flow,s26Eric,s26Saved).art?.file,'s26-eric-choice.png');
});

test('completion position retains the month-later CG and a fresh scene cannot inherit it',()=>{
 const expected={S44:'s44-eric-epilogue-month-later.png',S45:'s45-nick-home-epilogue-month-later.png',S46:'s46-damir-epilogue-month-later.png',S47:'s47-alice-home-epilogue-month-later.png'};
 for(const [id,file] of Object.entries(expected)){
  const {flow,choices}=complete(id);
  const terminal=visualEntryForPosition(flow,flow.length);
  const final=visualAt(id,terminal,choices,stageForScene(id,choices).cast);
  assert.equal(final.art?.file,file,`${id} completion must retain its final CG`);
  assert.equal(visualAt('S01',null,{},stageForScene('S01',{}).cast).art?.file,'keflavik-airport-arrivals-v1.png');
 }
});
