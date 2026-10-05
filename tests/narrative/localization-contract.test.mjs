import assert from 'node:assert/strict';import fs from 'node:fs';import test from 'node:test';
import {literarySeason} from '../../src/literary-season-data.js';import {interactionBeats} from '../../src/literary-interactive-beats.js';import {createTranslator,sourceRef,validateLiteraryInteractionLocale,validateLiteraryLocale} from '../../src/localization.js';import {nextLiteraryScene} from '../../src/literary-engine.js';
test('UI dictionary is complete for both supported locales',()=>{for(const key of ['gameTitle','menuKicker','menuSummary','standaloneSummary','newGame','continueEpisode','episodes','settings','menu','backMenu','yourChoice','episode','returnMenu','nextScene','confirmNew','structuralError','sdkError','routeEric','routeNick','routeDamir','routeAlice','endingEric','endingNick','endingDamir','endingAlice','episodesDescription','episodeUnlocked','episodeLocked','episodeReplayConfirm','textSize','contrast','contrastOn','contrastOff','motion','motionOff','motionSystem','restoreCloud','restoreCloudConfirm','readerHeaderTitle','stageAdvanceAria','sceneAria','migrationNotice'])for(const locale of ['ru','en'])assert.ok(createTranslator(locale)(key,{episode:1,scene:'S02',title:'Title',percent:100,eric:'Eric',nick:'Nick',damir:'Damir',alice:'Alice',state:'on'}));});
test('incomplete English corpus fails closed with stable source refs',()=>{const report=validateLiteraryLocale(literarySeason,{locale:'en',scenes:{}});assert.equal(report.status,'BLOCKED_EN_CORPUS_INCOMPLETE');assert.ok(report.errors.includes('missing scene S01'));assert.equal(sourceRef.paragraph('S01',2,3),'S01.C002.P003');});
test('route graph is locale-independent structural code',()=>{const choices={'S17-C2':'A','S26-C1':'A'};assert.equal(nextLiteraryScene('S26',choices),'S27');assert.equal(nextLiteraryScene('S44',choices),null);});
test('structural saves contain no locale or localized prose',()=>{const state={schemaVersion:3,sceneId:'S01',position:4,choices:{'S01-C1':'A'},visited:['S01'],revision:2,runId:'run'};assert.equal('locale' in state,false);assert.equal(JSON.stringify(state).includes('Красный'),false);});
test('production English S01 is complete and structurally identical',()=>{
 const english=JSON.parse(fs.readFileSync(new URL('../../content/localization/en/S01.json',import.meta.url),'utf8'));
 const source=literarySeason.scenes.find(scene=>scene.id==='S01');
 const report=validateLiteraryLocale(literarySeason,english,{sceneIds:['S01']});
 assert.deepEqual(report,{status:'PASS',errors:[],sceneCount:1});
 assert.deepEqual(Object.keys(english.scenes),['S01']);
 assert.deepEqual(Object.keys(english.scenes.S01.chunks),source.chunks.map((_,index)=>sourceRef.chunk('S01',index)));
 assert.equal(Object.values(english.scenes.S01.chunks).reduce((count,chunk)=>count+Object.keys(chunk.paragraphs).length,0),64);
 assert.match(english.scenes.S01.chunks['S01.C001'].title,/S01-C1/);
 assert.deepEqual(['S01.C002','S01.C003','S01.C004'].map(ref=>english.scenes.S01.chunks[ref].title.slice(0,1)),['A','B','C']);
 const visible=[english.scenes.S01.title,...Object.values(english.scenes.S01.chunks).flatMap(chunk=>[chunk.title,...Object.values(chunk.paragraphs)])].join('\n');
 assert.doesNotMatch(visible,/[\u0400-\u04ff]/u);
});
test('production English Episodes 3-4 are complete, structurally identical, and predicate-safe',()=>{
 const expected={S09:{paragraphs:56,choices:1},S10:{paragraphs:52,choices:1},S11:{paragraphs:58,choices:1},S12:{paragraphs:97,choices:3},S13:{paragraphs:80,choices:1},S14:{paragraphs:64,choices:2},S15:{paragraphs:84,choices:1},S16:{paragraphs:39,choices:1}};
 for(const [sceneId,counts] of Object.entries(expected)){
  const english=JSON.parse(fs.readFileSync(new URL('../../content/localization/en/'+sceneId+'.json',import.meta.url),'utf8'));
  const source=literarySeason.scenes.find(scene=>scene.id===sceneId);
  const report=validateLiteraryLocale(literarySeason,english,{sceneIds:[sceneId]});
  assert.deepEqual(report,{status:'PASS',errors:[],sceneCount:1},sceneId);
  assert.deepEqual(Object.keys(english.scenes),[sceneId]);
  assert.deepEqual(Object.keys(english.scenes[sceneId].chunks),source.chunks.map((_,index)=>sourceRef.chunk(sceneId,index)));
  assert.equal(Object.values(english.scenes[sceneId].chunks).reduce((count,chunk)=>count+Object.keys(chunk.paragraphs).length,0),counts.paragraphs,sceneId+' paragraph count');
  assert.equal(source.chunks.filter(chunk=>chunk.title.startsWith('Выбор ')).length,counts.choices,sceneId+' choice count');
  source.chunks.forEach((chunk,index)=>{
   const sourceTitle=chunk.title;
   const translated=english.scenes[sceneId].chunks[sourceRef.chunk(sceneId,index)].title;
   for(const token of sourceTitle.match(/S\d{2}-C\d+|`[^`]+`/g)??[])assert.ok(translated.includes(token),sceneId+' missing stable token '+token);
  });
  const visible=[english.scenes[sceneId].title,...Object.values(english.scenes[sceneId].chunks).flatMap(chunk=>[chunk.title,...Object.values(chunk.paragraphs)])].join('\n');
  assert.doesNotMatch(visible,/[\u0400-\u04ff]/u,sceneId+' accidental Cyrillic');
 }
});
test('production English S02 is complete and structurally identical',()=>{
 const english=JSON.parse(fs.readFileSync(new URL('../../content/localization/en/S02.json',import.meta.url),'utf8'));
 const source=literarySeason.scenes.find(scene=>scene.id==='S02');
 const report=validateLiteraryLocale(literarySeason,english,{sceneIds:['S02']});
 assert.deepEqual(report,{status:'PASS',errors:[],sceneCount:1});
 assert.deepEqual(Object.keys(english.scenes),['S02']);
 assert.deepEqual(Object.keys(english.scenes.S02.chunks),source.chunks.map((_,index)=>sourceRef.chunk('S02',index)));
 assert.equal(Object.values(english.scenes.S02.chunks).reduce((count,chunk)=>count+Object.keys(chunk.paragraphs).length,0),77);
 assert.match(english.scenes.S02.chunks['S02.C001'].title,/S02-C1/);
 assert.deepEqual(['S02.C002','S02.C003','S02.C004'].map(ref=>english.scenes.S02.chunks[ref].title.slice(0,1)),['A','B','C']);
 const titles=['S02.C002','S02.C003','S02.C004'].map(ref=>english.scenes.S02.chunks[ref].title).join('\n');
 for(const predicate of ['careerThesis=people','careerThesis=place','careerThesis=own-choice','damirDirect=true'])assert.ok(titles.includes('`'+predicate+'`'));
 const visible=[english.scenes.S02.title,...Object.values(english.scenes.S02.chunks).flatMap(chunk=>[chunk.title,...Object.values(chunk.paragraphs)])].join('\n');
 assert.doesNotMatch(visible,/[\u0400-\u04ff]/u);
});
test('production English Episode 1 continuation scenes are complete and structurally identical',()=>{
 const expected={S65:{paragraphs:106,choices:0},S03:{paragraphs:91,choices:1},S04:{paragraphs:136,choices:1}};
 for(const [sceneId,counts] of Object.entries(expected)){
  const english=JSON.parse(fs.readFileSync(new URL('../../content/localization/en/'+sceneId+'.json',import.meta.url),'utf8'));
  const source=literarySeason.scenes.find(scene=>scene.id===sceneId);
  const report=validateLiteraryLocale(literarySeason,english,{sceneIds:[sceneId]});
  assert.deepEqual(report,{status:'PASS',errors:[],sceneCount:1},sceneId);
  assert.deepEqual(Object.keys(english.scenes),[sceneId]);
  assert.deepEqual(Object.keys(english.scenes[sceneId].chunks),source.chunks.map((_,index)=>sourceRef.chunk(sceneId,index)));
  assert.equal(Object.values(english.scenes[sceneId].chunks).reduce((count,chunk)=>count+Object.keys(chunk.paragraphs).length,0),counts.paragraphs,sceneId+' paragraph count');
  const choiceTitles=Object.values(english.scenes[sceneId].chunks).filter(chunk=>chunk.title.startsWith('Choice ')).map(chunk=>chunk.title);
  assert.equal(choiceTitles.length,counts.choices,sceneId+' choice count');
  const visible=[english.scenes[sceneId].title,...Object.values(english.scenes[sceneId].chunks).flatMap(chunk=>[chunk.title,...Object.values(chunk.paragraphs)])].join('\n');
 assert.doesNotMatch(visible,/[\u0400-\u04ff]/u,sceneId+' accidental Cyrillic');
 }
});
test('production English Episode 2 is complete, structurally identical, and predicate-safe',()=>{
 const expected={S05:{paragraphs:103,choices:1},S06:{paragraphs:101,choices:1},S07:{paragraphs:122,choices:1},S08:{paragraphs:107,choices:1},S66:{paragraphs:105,choices:0}};
 for(const [sceneId,counts] of Object.entries(expected)){
  const english=JSON.parse(fs.readFileSync(new URL('../../content/localization/en/'+sceneId+'.json',import.meta.url),'utf8'));
  const source=literarySeason.scenes.find(scene=>scene.id===sceneId);
  const report=validateLiteraryLocale(literarySeason,english,{sceneIds:[sceneId]});
  assert.deepEqual(report,{status:'PASS',errors:[],sceneCount:1},sceneId);
  assert.deepEqual(Object.keys(english.scenes),[sceneId]);
  assert.deepEqual(Object.keys(english.scenes[sceneId].chunks),source.chunks.map((_,index)=>sourceRef.chunk(sceneId,index)));
  assert.equal(Object.values(english.scenes[sceneId].chunks).reduce((count,chunk)=>count+Object.keys(chunk.paragraphs).length,0),counts.paragraphs,sceneId+' paragraph count');
  assert.equal(source.chunks.filter(chunk=>chunk.title.startsWith('Выбор ')).length,counts.choices,sceneId+' choice count');
  source.chunks.forEach((chunk,index)=>{
   const sourceTitle=chunk.title;
   const translated=english.scenes[sceneId].chunks[sourceRef.chunk(sceneId,index)].title;
   for(const token of sourceTitle.match(/S\d{2}-C\d+|`[^`]+`/g)??[])assert.ok(translated.includes(token),sceneId+' missing stable token '+token);
  });
  const visible=[english.scenes[sceneId].title,...Object.values(english.scenes[sceneId].chunks).flatMap(chunk=>[chunk.title,...Object.values(chunk.paragraphs)])].join('\n');
  assert.doesNotMatch(visible,/[\u0400-\u04ff]/u,sceneId+' accidental Cyrillic');
 }
});
test('production English Episodes 5-6 preserve complete scene, choice, predicate, and interaction structure',()=>{
 const expected={
  S17:{paragraphs:75,choices:2},S18:{paragraphs:75,choices:2},S19:{paragraphs:97,choices:3},S20:{paragraphs:56,choices:2},S21:{paragraphs:23,choices:2},S61:{paragraphs:34,choices:1},
  S22:{paragraphs:60,choices:2},S23:{paragraphs:65,choices:1},S24:{paragraphs:55,choices:1},S25:{paragraphs:56,choices:1},S58:{paragraphs:47,choices:1},S26:{paragraphs:66,choices:1}
 };
 for(const [sceneId,counts] of Object.entries(expected)){
  const english=JSON.parse(fs.readFileSync(new URL('../../content/localization/en/'+sceneId+'.json',import.meta.url),'utf8'));
  const source=literarySeason.scenes.find(scene=>scene.id===sceneId);
  assert.deepEqual(validateLiteraryLocale(literarySeason,english,{sceneIds:[sceneId]}),{status:'PASS',errors:[],sceneCount:1},sceneId);
  assert.deepEqual(Object.keys(english.scenes),[sceneId]);
  assert.equal(Object.values(english.scenes[sceneId].chunks).reduce((count,chunk)=>count+Object.keys(chunk.paragraphs).length,0),counts.paragraphs,sceneId+' paragraph count');
  assert.equal(source.chunks.filter(chunk=>chunk.title.startsWith('Выбор ')).length,counts.choices,sceneId+' choice count');
  source.chunks.forEach((chunk,index)=>{const sourceTitle=chunk.title,translated=english.scenes[sceneId].chunks[sourceRef.chunk(sceneId,index)].title;for(const token of sourceTitle.match(/S\d{2}-C\d+|`[^`]+`/g)??[])assert.ok(translated.includes(token),sceneId+' missing stable token '+token);});
  const visible=[english.scenes[sceneId].title,...Object.values(english.scenes[sceneId].chunks).flatMap(chunk=>[chunk.title,...Object.values(chunk.paragraphs)])].join('\n');
  assert.doesNotMatch(visible,/[Ѐ-ӿ]/u,sceneId+' accidental Cyrillic');
 }
 const translated=JSON.parse(fs.readFileSync(new URL('../../content/localization/en/interaction-beats.json',import.meta.url),'utf8'));
 const interactionSceneIds=Object.keys(expected).filter(id=>Object.prototype.hasOwnProperty.call(interactionBeats,id));
 const scopedInteractions={interactionBeats:Object.fromEntries(interactionSceneIds.map(id=>[id,translated.interactionBeats[id]]))};
 assert.deepEqual(validateLiteraryInteractionLocale(interactionBeats,scopedInteractions,{sceneIds:interactionSceneIds}),{status:'PASS',errors:[],sceneCount:interactionSceneIds.length});
 const routeTitles=['S26.C002','S26.C008','S26.C014','S26.C020'].map(ref=>translatedSceneChunk('S26',ref,translated));
 assert.deepEqual(routeTitles.map(title=>title.match(/routeIntent=(?:eric|nick|damir|alice)/)?.[0]),['routeIntent=eric','routeIntent=nick','routeIntent=damir','routeIntent=alice']);
 function translatedSceneChunk(sceneId,ref){return JSON.parse(fs.readFileSync(new URL('../../content/localization/en/'+sceneId+'.json',import.meta.url),'utf8')).scenes[sceneId].chunks[ref].title;}
});
test('production English Episode 9 is complete, structurally identical, and preserves interaction parity',()=>{
 const expected={S36:{paragraphs:7,choices:1},S37:{paragraphs:13,choices:2},S51:{paragraphs:10,choices:1},S38:{paragraphs:14,choices:2},S54:{paragraphs:11,choices:1},S39:{paragraphs:13,choices:2},S57:{paragraphs:9,choices:1},S40:{paragraphs:9,choices:2},S64:{paragraphs:8,choices:1},S60:{paragraphs:6,choices:1}};
 for(const [sceneId,counts] of Object.entries(expected)){
  const english=JSON.parse(fs.readFileSync(new URL('../../content/localization/en/'+sceneId+'.json',import.meta.url),'utf8'));
  const source=literarySeason.scenes.find(scene=>scene.id===sceneId);
  assert.deepEqual(validateLiteraryLocale(literarySeason,english,{sceneIds:[sceneId]}),{status:'PASS',errors:[],sceneCount:1},sceneId);
  assert.deepEqual(Object.keys(english.scenes[sceneId].chunks),source.chunks.map((_,index)=>sourceRef.chunk(sceneId,index)));
  assert.equal(Object.values(english.scenes[sceneId].chunks).reduce((count,chunk)=>count+Object.keys(chunk.paragraphs).length,0),counts.paragraphs,sceneId+' paragraph count');
  assert.equal(source.chunks.filter(chunk=>chunk.title.startsWith('Выбор ')).length,counts.choices,sceneId+' choice count');
  source.chunks.forEach((chunk,index)=>{for(const token of chunk.title.match(/S\d{2}-C\d+|`[^`]+`/g)??[])assert.ok(english.scenes[sceneId].chunks[sourceRef.chunk(sceneId,index)].title.includes(token),sceneId+' missing stable token '+token);});
  const visible=[english.scenes[sceneId].title,...Object.values(english.scenes[sceneId].chunks).flatMap(chunk=>[chunk.title,...Object.values(chunk.paragraphs)])].join('\n');
  assert.doesNotMatch(visible,/[Ѐ-ӿ]/u,sceneId+' accidental Cyrillic');
 }
 const localized=JSON.parse(fs.readFileSync(new URL('../../content/localization/en/interaction-beats.json',import.meta.url),'utf8'));
 const sceneIds=Object.keys(expected);
 const scoped={interactionBeats:Object.fromEntries(sceneIds.map(id=>[id,localized.interactionBeats[id]])),interactionEchoes:Object.fromEntries(sceneIds.filter(id=>localized.interactionEchoes[id]).map(id=>[id,localized.interactionEchoes[id]]))};
 assert.deepEqual(validateLiteraryInteractionLocale(interactionBeats,scoped,{sceneIds}),{status:'PASS',errors:[],sceneCount:sceneIds.length});
});
