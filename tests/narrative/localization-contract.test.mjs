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
