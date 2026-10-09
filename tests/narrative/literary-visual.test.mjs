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
test('S01 physical placard is localized at the authored nick-arrives cue and stays separate from airport-outside',()=>{
 const cue=visualCues.S01.find(item=>item.id==='nick-arrives');
 assert.deepEqual(cue.at,[0,4]);
 assert.deepEqual(cue.localizedArt,{ru:'cg/s01-nick-arrives-placard-ru.webp',en:'cg/s01-nick-arrives-placard-en.webp'});
 assert.deepEqual(cue.localizedPortraitArt,{ru:'cg/s01-nick-arrives-placard-ru-portrait.webp',en:'cg/s01-nick-arrives-placard-en-portrait.webp'});
 const {flow,choices}=complete('S01');
 const position=indexOfSource(flow,0,4);
 const direction=shot('S01',flow,position,choices);
 assert.equal(direction.beatId,'nick-arrives');
 assert.equal(direction.art?.file,'s01-nick-arrives-placard-ru.webp');
 assert.deepEqual(direction.art?.localeFiles,{ru:'s01-nick-arrives-placard-ru.webp',en:'s01-nick-arrives-placard-en.webp'});
 assert.deepEqual(direction.art?.localePortraitFiles,{ru:'s01-nick-arrives-placard-ru-portrait.webp',en:'s01-nick-arrives-placard-en-portrait.webp'});
 const outside=shot('S01',flow,indexOfSource(flow,0,16),choices);
 assert.equal(outside.beatId,'airport-outside');
 assert.equal(outside.art?.file,'s01-airport-outside-batch2.webp');
});
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

test('S02 uses the accepted integrated moving-van CG until the authored cafe cue',()=>{
 const {flow,choices}=complete('S02');
 assert.equal(shot('S02',flow,0,choices).location,'Автомобиль по дороге в Рейкьявик');
 assert.equal(shot('S02',flow,0,choices).beatId,'scene-start');
 assert.equal(shot('S02',flow,0,choices).art?.file,'s02-van-group-batch2.webp');
 assert.equal(shot('S02',flow,0,choices).art?.type,'cg');
 assert.deepEqual(shot('S02',flow,0,choices).requiredCast,['alice','eric','nick','damir']);
 const cafe=indexOfSource(flow,0,31);
 assert.equal(shot('S02',flow,cafe,choices).beatId,'roadside-cafe');
 assert.equal(shot('S02',flow,cafe,choices).art?.file,'s02-roadside-cafe-group.webp');
 assert.equal(shot('S02',flow,cafe,choices).art?.type,'cg');
 assert.deepEqual(shot('S02',flow,cafe,choices).cast,['alice','eric','nick','damir']);
 assert.deepEqual(shot('S02',flow,cafe,choices).requiredCast,['alice','eric','nick','damir']);
 assert.equal(shot('S02',flow,cafe-1,choices).art?.file,'s02-van-group-batch2.webp');
});

test('Batch 2 recovery maps the six accepted CGs to exact canonical cues and cast',()=>{
 const expected={
  'S01/airport-outside':{id:'S01',ref:[0,16],beat:'airport-outside',file:'s01-airport-outside-batch2.webp',cast:['alice','nick','eric']},
  'S01/damir-arrives':{id:'S01',ref:[0,24],beat:'damir-arrives',file:'s01-damir-arrives-batch2.webp',cast:['alice','nick','eric','damir']},
  'S48/scene-start':{id:'S48',ref:[0,0],file:'s48-last-breakfast-batch2.webp',cast:['alice','eric','nick','damir']},
  'S26/scene-start':{id:'S26',ref:[0,0],file:'s26-power-outage-notebook.webp',cast:['alice'],requiredCast:[]},
  'S02/scene-start':{id:'S02',ref:[0,0],file:'s02-van-group-batch2.webp',cast:['alice','eric','nick','damir']},
  'S60/scene-start':{id:'S60',ref:[0,0],file:'s60-souvenir-kitchen-batch2.webp',cast:['alice','eric','nick','damir']}
 };
 for(const [cue,cfg] of Object.entries(expected)){
  const {choices}=complete(cfg.id);
  const direction=shot(cfg.id,[{sourceEndRef:{chunk:cfg.ref[0],paragraph:cfg.ref[1]}}],0,choices);
  assert.equal(direction.beatId,cfg.beat ?? 'scene-start',cue);
  assert.equal(direction.art?.type,'cg',cue);
  assert.equal(direction.art?.file,cfg.file,cue);
  assert.deepEqual(direction.cast,cfg.cast,cue);
  assert.deepEqual(direction.requiredCast,cfg.requiredCast ?? cfg.cast,cue);
  assert.ok(fs.existsSync(new URL(`../../assets/cg/${cfg.file}`,import.meta.url)),cue);
  assert.ok(fs.existsSync(new URL(`../../assets/cg/${cfg.file.replace('.webp','-portrait.webp')}`,import.meta.url)),cue);
 }
});

test('Batch 3 reframes bind only the eight selected authored cues',()=>{
 const pairCues=[
  ['S01','nick-arrives',{},'batch3-pair-depth-s01-nick-arrives'],
  ['S18','scene-start',{},'batch3-pair-depth-s18-opening'],
  ['S28','scene-start',{},'batch3-pair-depth-s28-opening'],
  ['S30','scene-start',{},'batch3-pair-depth-s30-opening']
 ];
 for(const [id,beat,choices,layout] of pairCues){
  const {flow}=complete(id,choices);
  const position=flow.findIndex(entry=>shot(id,flow,flow.indexOf(entry),choices).beatId===beat);
  const direction=shot(id,flow,position,choices);
  assert.equal(direction.stageComposition,layout,`${id}/${beat} must own its Batch 3 layout`);
  assert.deepEqual(direction.cast,['alice',id==='S01'?'nick':id==='S18'||id==='S28'?'eric':'damir']);
 }
 for(const route of ['A','B','C']){
  const choices={'S26-C1':route};
  const {flow}=complete('S42',choices);
  const direction=shot('S42',flow,0,choices);
  assert.equal(direction.beatId,'s42-harbour-cafe');
  assert.equal(direction.art?.file,'s42-harbour-cafe.webp');
 }
 const {flow}=complete('S46');
 const airport=shot('S46',flow,0,{});
 assert.equal(airport.beatId,'airport-bus');
 assert.equal(airport.art?.file,'s46-airport-bus.webp');
});

test('Final Batch 4 reframes bind only the ten selected authored cues',()=>{
 const expected={
  'S33/scene-start':'batch4-pair-depth-s33','S34/scene-start':'batch4-pair-depth-s34',
  'S37/scene-start':'batch4-pair-depth-s37','S49/scene-start':'batch4-pair-depth-s49',
  'S50/scene-start':'batch4-pair-depth-s50','S52/scene-start':'batch4-pair-depth-s52',
  'S55/scene-start':'batch4-pair-depth-s55','S35/scene-start':'batch4-solo-depth-s35',
  'S41/editor-cafe-call':'batch4-solo-depth-s41'
 };
 for(const [cue,layout] of Object.entries(expected)){
  const [id,beat]=cue.split('/');
  const {flow,choices}=complete(id);
  const position=flow.findIndex((_,index)=>shot(id,flow,index,choices).beatId===beat);
  assert.ok(position>=0,`${cue} must be reachable`);
  assert.equal(shot(id,flow,position,choices).stageComposition,layout,cue);
 }
 const {flow,choices}=complete('S03');
 const editor=shot('S03',flow,0,choices);
 assert.equal(editor.beatId,'editor-call');
 assert.equal(editor.art?.file,'s03-editor-call.webp');
 assert.equal(editor.art?.type,'cg');
});

test('Episode 1 S02 never interleaves the roadside cafe and car across choice variants',()=>{
 for(const extraA of ['A','B'])for(const extraB of ['A','B'])for(const authored of ['A','B','C']){
  const choices={'S01-C1':'A','S02-C90':extraA,'S02-C91':extraB,'S02-C1':authored};
  const flow=compileInteractivePlayback(scenes.get('S02'),choices);
  const locations=flow.map(entry=>shot('S02',[entry],0,choices).location);
  const transitions=locations.filter((location,index)=>index===0||location!==locations[index-1]);
  assert.deepEqual(transitions,['Автомобиль по дороге в Рейкьявик','Придорожное кафе'],`${extraA}/${extraB}/${authored}`);
  const cafe=indexOfSource(flow,0,31);
  assert.ok(flow.slice(cafe).every(entry=>shot('S02',[entry],0,choices).location==='Придорожное кафе'));
  assert.ok(flow.slice(cafe).every(entry=>shot('S02',[entry],0,choices).art?.file==='s02-roadside-cafe-group.webp'));
 }
});

test('S66 greenhouse uses the authored environment and its independent portrait mapping',()=>{
 const {flow,choices}=complete('S66');
 const opening=shot('S66',flow,0,choices);
 assert.equal(opening.art?.type,'background');
 // Baseline updated for cf0cb3d: current integrated runtime mapping uses the
 // accepted greenhouse-cafe background; the dedicated S66 asset remains a
 // manifest candidate/reference and is not the active scene-start mapping.
 assert.equal(opening.art?.file,'hveragerdi-greenhouse-cafe.webp');
 assert.ok(fs.existsSync(new URL('../../assets/backgrounds/hveragerdi-greenhouse-cafe.webp',import.meta.url)));
});

test('S05 Hveragerði van warning uses the repaired cinematic asset',()=>{
 const {flow,choices}=complete('S05');
 const opening=shot('S05',flow,0,choices);
 assert.equal(opening.art?.file,'s05-hveragerdi-van-warning-rework.webp');
 assert.equal(opening.art?.type,'cg');
 assert.ok(fs.existsSync(new URL('../../assets/cg/s05-hveragerdi-van-warning-rework.webp',import.meta.url)));
 assert.ok(fs.existsSync(new URL('../../assets/cg/s05-hveragerdi-van-warning-rework-portrait.webp',import.meta.url)));
});

test('S06-S08 pilot uses authored cinematic events with independent portrait assets',()=>{
 const expected={
  S06:['s06-eric-alice-stream','s06-hveragerdi-eric-alice.webp',['alice','eric'],[6,6]],
  S07:['s07-kitchen-pasta','s07-kitchen-pasta.webp',['alice','nick','eric','damir'],[3,0]],
  S08:['s08-guesthouse-strap','s08-guesthouse-strap.webp',['alice','damir'],[2,0]]
 };
 for(const [id,[beat,file,cast,ref]] of Object.entries(expected)){
  const {flow,choices}=complete(id);
  const at=indexOfSource(flow,ref[0],ref[1]);
  const shotAt=shot(id,flow,at,choices);
  assert.equal(shotAt.beatId,beat);
  assert.equal(shotAt.art?.presentation,'cinematic');
  assert.equal(shotAt.art?.file,file);
  assert.deepEqual(shotAt.cast,cast);
  assert.ok(fs.existsSync(new URL(`../../assets/cg/${file}`,import.meta.url)));
  assert.ok(fs.existsSync(new URL(`../../assets/cg/${file.replace('.webp','-portrait.webp')}`,import.meta.url)));
 }
 const {flow,choices}=complete('S07');
 const cards=indexOfSource(flow,3,42);
 assert.equal(shot('S07',flow,cards,choices).beatId,'s07-kitchen-cards');
 assert.equal(shot('S07',flow,cards,choices).art?.presentation,'cinematic');
});

test('S10 and S12 use bounded cinematic events and clear them at the location transition',()=>{
 const expected={
  S10:{beat:'s10-vik-road-song',file:'s10-vik-road-song.webp',cast:['alice','eric'],ref:[0,0],clear:[6,0]},
  S12:{beat:'s12-vik-cafe-damir',file:'s12-vik-cafe-damir-rework.webp',cast:['alice','damir'],ref:[0,0],clear:[11,0]}
 };
 for(const [id,cfg] of Object.entries(expected)){
  const {flow,choices}=complete(id);
  const at=indexOfSource(flow,...cfg.ref), shotAt=shot(id,flow,at,choices);
  assert.equal(shotAt.beatId,cfg.beat);
  assert.equal(shotAt.art?.presentation,'cinematic');
  assert.equal(shotAt.art?.file,cfg.file);
  assert.deepEqual(shotAt.cast,cfg.cast);
  assert.ok(fs.existsSync(new URL(`../../assets/cg/${cfg.file}`,import.meta.url)));
  assert.ok(fs.existsSync(new URL(`../../assets/cg/${cfg.file.replace('.webp','-portrait.webp')}`,import.meta.url)));
  const cleared=indexOfSource(flow,...cfg.clear);
  assert.ok(shot(id,flow,cleared,choices).art);
  assert.notEqual(shot(id,flow,cleared,choices).beatId,cfg.beat);
 }
});

test('offline art repair recovery maps the seven repaired cues to exact CG and portrait assets',()=>{
 const expected={
  S04:['thingvellir-trail',[0,4],'s04-thingvellir-trail-rework.webp',['alice','eric','nick','damir']],
  S05:['s05-hveragerdi-van-warning',[0,0],'s05-hveragerdi-van-warning-rework.webp',['alice','eric','nick','damir']],
  S11:['s11-reynisfjara-information-board',[0,0],'s11-reynisfjara-information-board-rework.webp',['alice','damir','nick','eric']],
  S12:['s12-vik-cafe-damir',[0,0],'s12-vik-cafe-damir-rework.webp',['alice','damir']],
  S14:['s14-skaftafell-pace',[0,0],'s14-skaftafell-pace-rework.webp',['alice','eric']],
  S19:['s19-hofn-pool-entrance',[0,0],'s19-hofn-pool-opening-rework.webp',['alice','nick']],
  S22:['s22-eastfjords-van-road',[0,0],'s22-eastfjords-van-road-rework.webp',['alice','eric','nick','damir']]
 };
 const player=fs.readFileSync(new URL('../../src/literary-player.js',import.meta.url),'utf8');
 for(const [id,[beat,ref,file,cast]] of Object.entries(expected)){
  const {flow,choices}=complete(id);
  const at=indexOfSource(flow,...ref);
  const direction=shot(id,flow,at,choices);
  assert.equal(direction.beatId,beat,id);
  assert.equal(direction.art?.type,'cg',id);
  assert.equal(direction.art?.file,file,id);
  assert.deepEqual(direction.cast,cast,id);
  const portrait=file.replace('.webp','-portrait.webp');
  assert.ok(fs.existsSync(new URL(`../../assets/cg/${file}`,import.meta.url)),id);
  assert.ok(fs.existsSync(new URL(`../../assets/cg/${portrait}`,import.meta.url)),id);
  assert.match(player,new RegExp(`'${file}':'${portrait}'`),id);
 }
});

test('S13-S16 preserve environment transitions and use only authored cinematic events',()=>{
 const expected={
  S13:[['skaftafell-parking',[0,7],null,'environment'],['skaftafell-notebook',[0,12],'s13-skaftafell-travelers.webp','cinematic']],
  S14:[['s14-skaftafell-pace',[0,0],'s14-skaftafell-pace-rework.webp','cinematic'],['s14-lagoon-road',[7,0],null,'environment']],
  S15:[['jokulsarlon-lagoon',[0,5],'jokulsarlon-master.webp','environment']],
  S16:[['s16-guesthouse-help',[0,1],'s16-guesthouse-help.webp','cinematic'],['s16-kitchen-soup',[4,0],'s16-kitchen-soup.webp','cinematic']]
 };
 for(const [id,events] of Object.entries(expected)){
  const {flow,choices}=complete(id);
  for(const [beat,ref,file,presentation] of events){
   const at=indexOfSource(flow,...ref),shotAt=shot(id,flow,at,choices);
   assert.equal(shotAt.beatId,beat);
   if(file){
    assert.equal(shotAt.art?.file,file);
    assert.equal(shotAt.art?.presentation,presentation);
   }else assert.ok(shotAt.art);
   if(file){
    assert.ok(fs.existsSync(new URL(`../../assets/${presentation==='cinematic'?'cg':'backgrounds'}/${file}`,import.meta.url)));
    if(presentation==='cinematic')assert.ok(fs.existsSync(new URL(`../../assets/cg/${file.replace('.webp','-portrait.webp')}`,import.meta.url)));
   }
  }
 }
 const {flow,choices}=complete('S14');
 assert.equal(shot('S14',flow,indexOfSource(flow,7,0),choices).art?.file,'s14-lagoon-road.webp');
});

test('S13 visitor center precedes notebook CG; image is not used in Vik',()=>{
 const {flow,choices}=complete('S13');
 const arrival=indexOfSource(flow,0,7),notebook=indexOfSource(flow,0,12);
 // Baseline updated for cf0cb3d: a scene-start environment is now present,
 // then the authored parking cue intentionally clears it before the notebook CG.
 assert.equal(shot('S13',flow,0,choices).art?.file,'s13-skaftafell-visitor-parking.webp');
 assert.equal(shot('S13',flow,arrival,choices).art?.file,'s13-skaftafell-visitor-parking.webp');
 assert.equal(shot('S13',flow,notebook,choices).art?.file,'s13-skaftafell-travelers.webp');
 assert.ok(arrival<notebook);
});

test('S18 dance happens before the kiss choice on all options; walking back and morning end it',()=>{
 for(const option of ['A','B','C']){
  const {flow,choices}=complete('S18',{'S17-C2':'A','S18-C1':option});
  const dance=indexOfSource(flow,0,35),walk=indexOfSource(flow,0,39),morning=indexOfSource(flow,5,1),breakfast=indexOfSource(flow,5,3);
  assert.equal(shot('S18',flow,dance,choices).art?.file,'s18-hofn-dance-lights.webp');
  assert.equal(shot('S18',flow,walk,choices).art?.type,'background');
  assert.equal(shot('S18',flow,morning,choices).art?.file,'s18-hofn-day10-room.webp');
  assert.equal(shot('S18',flow,breakfast,choices).art?.file,'s18-hofn-breakfast-group.webp');
  assert.deepEqual(shot('S18',flow,breakfast,choices).cast,['alice','eric','nick','damir']);
  assert.ok(dance<walk&&walk<morning&&morning<breakfast);
 }
});

test('finale location and art change at the literal month-later epilogue for all four routes',()=>{
 const cfg={S44:['s44-eric-epilogue-month-later.webp',4],S45:['s45-nick-home-epilogue-month-later.webp',4],S46:['s46-damir-epilogue-month-later.webp',4],S47:['s47-alice-home-epilogue-month-later.webp',4]};
 for(const [id,[expectedCG,chapter]] of Object.entries(cfg)){
  const {flow,choices}=complete(id);
  const first=shot(id,flow,0,choices);
  if(id==='S45')assert.equal(first.art?.file,'s45-reykjavik-warm-montage.webp');
  if(id==='S46')assert.equal(first.art?.file,'s46-airport-bus.webp');
  if(id==='S47')assert.equal(first.art?.file,'s47-reykjavik-harbour-alice.webp');
  if(id==='S46'){
   assert.equal(first.art?.file,'s46-airport-bus.webp');
   assert.equal(shot(id,flow,indexOfSource(flow,0,1),choices).art?.file,'s46-airport-goodbye.webp');
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
  if(route==='A') assert.equal(shot('S26',flow,routeAt,choices).art?.file,'s26-eric-choice.webp');
  if(route==='A') assert.equal(shot('S26',flow,embraceAt,choices).art?.file,'s26-eric-choice.webp');
  else assert.notEqual(shot('S26',flow,embraceAt,choices).art?.file,'s26-eric-choice.webp');
 }
});

test('S26 non-Eric route CGs appear only after their own route lock',()=>{
 const expected={B:['route-nick','s26-nick-choice.webp',8],C:['route-damir','s26-damir-choice.webp',14],D:['route-independent','s26-alice-choice.webp',20]};
 for(const [route,[beat,file,chunk]] of Object.entries(expected)){
  const {flow,choices}=complete('S26',{'S26-C90':'A','S26-C1':route});
  const before=indexOfSource(flow,chunk,0)-1;
  const after=indexOfSource(flow,chunk,0);
  assert.notEqual(shot('S26',flow,before,choices).art?.file,file,`${route} art must be absent before route lock`);
  assert.equal(shot('S26',flow,after,choices).art?.file,file,`${route} art must start at route lock`);
  assert.deepEqual(shot('S26',flow,after,choices).cast,route==='B'?['alice','nick']:route==='C'?['alice','damir']:['alice']);
 }
});

test('S02 and S26 visual state survives a save/load-shaped choice round trip',()=>{
 const s02=complete('S02');
 const s02Saved=JSON.parse(JSON.stringify(s02.choices));
 const s02Cafe=indexOfSource(s02.flow,0,31);
 assert.equal(shot('S02',s02.flow,s02Cafe,s02Saved).art?.file,'s02-roadside-cafe-group.webp');
 const s26=complete('S26',{'S26-C90':'A','S26-C1':'A'});
 const s26Saved=JSON.parse(JSON.stringify(s26.choices));
 const s26Eric=indexOfSource(s26.flow,7,0);
 assert.equal(shot('S26',s26.flow,s26Eric,s26Saved).art?.file,'s26-eric-choice.webp');
});

test('completion position retains the month-later CG and a fresh scene cannot inherit it',()=>{
 const expected={S44:'s44-eric-epilogue-month-later.webp',S45:'s45-nick-home-epilogue-month-later.webp',S46:'s46-damir-epilogue-month-later.webp',S47:'s47-alice-home-epilogue-month-later.webp'};
 for(const [id,file] of Object.entries(expected)){
  const {flow,choices}=complete(id);
  const terminal=visualEntryForPosition(flow,flow.length);
  const final=visualAt(id,terminal,choices,stageForScene(id,choices).cast);
  assert.equal(final.art?.file,file,`${id} completion must retain its final CG`);
   assert.equal(visualAt('S01',null,{},stageForScene('S01',{}).cast).art?.file,'keflavik-airport-arrivals-v1.webp');
 }
});


test('release reader has no artless visual states or explicit null-art transitions',()=>{
  for(const [id,scene] of scenes){
    const variants=id==='S26'?['A','B','C','D']:['A'];
    for(const route of variants){
      const overrides={'S17-C2':'A','S18-C1':'A'};
      if(id==='S26')overrides['S26-C1']=route;
      const {flow,choices}=complete(id,overrides);
      for(const [index] of flow.entries()){
        const direction=shot(id,flow,index,choices);
        assert.ok(direction.art,`${id} position ${index} exposes an artless release stage at beat ${direction.beatId}`);
      }
    }
  }
  for(const [id,cues] of Object.entries(visualCues)){
    for(const cue of cues){
      assert.notEqual(cue.art,null,`${id}/${cue.id} explicitly clears release art`);
    }
  }
});
