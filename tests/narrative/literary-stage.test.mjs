import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {literarySeason} from '../../src/literary-season-data.js';
import {stageSceneIds, stageForScene, stageForPlayback} from '../../src/literary-stage.js';
import {compileScenePlayback} from '../../src/literary-engine.js';

const byId=new Map(literarySeason.scenes.map(s=>[s.id,s]));
test('all authored scene IDs have a deterministic staging contract',()=>{
 assert.deepEqual(new Set(stageSceneIds),new Set(byId.keys()));
 for(const id of byId.keys()){
  const direction=stageForScene(id,{'S26-C1':'A'});
  assert.ok(['solo','pair','group'].includes(direction.mode));
  assert.equal(new Set(direction.cast).size,direction.cast.length);
  assert.ok(direction.cast.every(v=>['alice','eric','nick','damir'].includes(v)));
 }
});
test('S01 stage entrances are tied to authored beats and never flicker with prose mentions',()=>{
 const flow=compileScenePlayback(byId.get('S01'),{});
 const at=phrase=>flow.findIndex(e=>e.type==='paragraph'&&e.text.startsWith(phrase));
 const entrances=[
  [0,['alice']],
  [at('Мужчина держал картонную табличку'),['alice','nick']],
  [at('За стеклянными дверями аэропорта'),['alice','nick','eric']],
  [at('Четвёртый участник стоял у автомата'),['alice','nick','eric','damir']]
 ];
 for(const [position,cast] of entrances){assert.ok(position>=0);assert.deepEqual(stageForPlayback('S01',flow,position,{}).cast,cast)}
 for(let i=entrances[2][0];i<entrances[3][0];i++)assert.deepEqual(stageForPlayback('S01',flow,i,{}).cast,['alice','nick','eric']);
});
test('S18 breakfast cast is revealed only after the morning transition',()=>{
 const choices={'S17-C2':'A','S18-C1':'A'};
 const flow=compileScenePlayback(byId.get('S18'),choices);
 const dawn=flow.findIndex(e=>e.type==='paragraph'&&e.text.includes('Утром десятого дня'));
 assert.ok(dawn>0);
 assert.deepEqual(stageForPlayback('S18',flow,dawn-1,choices).cast,['alice','eric']);
 assert.deepEqual(stageForPlayback('S18',flow,dawn,choices).cast,['alice','eric','nick','damir']);
 assert.deepEqual(stageForScene('S42',{'S26-C1':'B'}).cast,['alice','nick']);
});
test('all stage actor exports have real transparent RGBA pixels, never RGB black matte',()=>{
 for(const id of ['alice','eric','nick','damir']){
  const image=fs.readFileSync(new URL(`../../assets/characters/${id}-stage.png`,import.meta.url));
  assert.equal(image.toString('hex',0,8),'89504e470d0a1a0a');
  assert.equal(image.readUInt8(25),6,`${id} must be PNG truecolor with alpha`);
 }
 const css=fs.readFileSync(new URL('../../src/literary.css',import.meta.url),'utf8');
 assert.doesNotMatch(css,/mix-blend-mode:\s*screen/);
});
