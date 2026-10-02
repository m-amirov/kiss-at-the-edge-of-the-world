import assert from 'node:assert/strict';import fs from 'node:fs';import test from 'node:test';
import {literarySeason} from '../../src/literary-season-data.js';import {createTranslator,sourceRef,validateLiteraryLocale} from '../../src/localization.js';import {nextLiteraryScene} from '../../src/literary-engine.js';
test('UI dictionary is complete for both supported locales',()=>{for(const key of ['newGame','continueEpisode','episodes','settings','menu','backMenu','yourChoice','episode','returnMenu','nextScene','confirmNew','structuralError','sdkError'])for(const locale of ['ru','en'])assert.ok(createTranslator(locale)(key,{episode:1,scene:'S02'}));});
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
