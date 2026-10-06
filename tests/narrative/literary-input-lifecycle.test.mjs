import test from 'node:test';
import assert from 'node:assert/strict';
import {createInputLifecycle} from '../../src/literary-input-lifecycle.js';

function event(type,pointerId=1,{detail=1,pointerType='touch'}={}){return {type,pointerId,detail,pointerType,target:'choice-A',defaultPrevented:false,cancelBubble:false};}

test('a gesture that advances into a choice cannot select that newly rendered choice',()=>{
  const input=createInputLifecycle();
  const scene=input.beginRender({sceneId:'S01',choiceId:null});
  input.pointerDown(event('pointerdown'),scene);
  assert.equal(input.pointerUp(event('pointerup'),scene,'advance').accepted,true);
  const choice=input.beginRender({sceneId:'S01',choiceId:'S01-C1'});
  assert.equal(input.click(event('click'),choice,'selectChoice').accepted,false);
  assert.equal(input.click(event('click',1,{detail:0}),choice,'selectChoice').accepted,true,'keyboard/AT click remains available');
});

test('pointerup plus synthetic click performs exactly one action',()=>{
  const input=createInputLifecycle();
  const scene=input.beginRender({sceneId:'S01',choiceId:null});
  input.pointerDown(event('pointerdown'),scene);
  assert.equal(input.pointerUp(event('pointerup'),scene,'advance').accepted,true);
  assert.equal(input.click(event('click'),scene,'advance').accepted,false);
});

test('rerender cycles do not duplicate a pointer action',()=>{
  const input=createInputLifecycle();
  const first=input.beginRender({sceneId:'S01',choiceId:null});
  input.pointerDown(event('pointerdown'),first);
  const rerendered=input.beginRender({sceneId:'S01',choiceId:null});
  assert.equal(input.pointerUp(event('pointerup'),rerendered,'advance').accepted,false);
  input.pointerDown(event('pointerdown',2),rerendered);
  assert.equal(input.pointerUp(event('pointerup',2),rerendered,'advance').accepted,true);
});

test('a delayed callback from a prior render generation is rejected in choice state',()=>{
  const input=createInputLifecycle();
  const page=input.beginRender({sceneId:'S01',choiceId:null});
  const choice=input.beginRender({sceneId:'S01',choiceId:'S01-C1'});
  assert.equal(input.callback(page,'advance').accepted,false);
  assert.equal(input.callback(choice,'selectChoice').accepted,false);
});

test('rapid distinct taps cannot skip a choice and a new gesture can select it',()=>{
  const input=createInputLifecycle();
  const page=input.beginRender({sceneId:'S01',choiceId:null});
  input.pointerDown(event('pointerdown'),page);
  assert.equal(input.pointerUp(event('pointerup'),page,'advance').accepted,true);
  const choice=input.beginRender({sceneId:'S01',choiceId:'S01-C1'});
  assert.equal(input.pointerUp(event('pointerup'),choice,'selectChoice').accepted,false);
  input.pointerDown(event('pointerdown',2),choice);
  assert.equal(input.pointerUp(event('pointerup',2),choice,'selectChoice').accepted,true);
});

test('an unfinished choice has no semantic action to persist or restore',()=>{
  const input=createInputLifecycle();
  const choice=input.beginRender({sceneId:'S01',choiceId:'S01-C1'});
  assert.equal(input.snapshot().semanticActionCount,0);
  assert.equal(input.click(event('click'),choice,'selectChoice').accepted,false);
  assert.equal(input.snapshot().semanticActionCount,0);
});
