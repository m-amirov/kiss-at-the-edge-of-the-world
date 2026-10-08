import assert from 'node:assert/strict';
import test from 'node:test';
import {literarySeason} from '../../src/literary-season-data.js';
import {compileInteractivePlayback} from '../../src/literary-pacing.js';
import {visualAt} from '../../src/literary-visual-directions.js';
import {stageForScene,stageCastForPresentation} from '../../src/literary-stage.js';
import {groupSemanticSignal,visualCastContract} from '../../src/literary-visual-contract.js';

const scene=literarySeason.scenes.find(item=>item.id==='S02');
const cast=['alice','eric','nick','damir'];
const choices={'S01-C1':'A','S02-C1':'A','S02-C90':'A','S02-C91':'A'};

function direction(entry,selected=choices){
  return visualAt('S02',entry,selected,stageForScene('S02',selected).cast);
}

test('S02 cafe requires and presents the complete four-person cast at every post-transition page',()=>{
  const flow=compileInteractivePlayback(scene,choices,'ru');
  const cafe=flow.findIndex(entry=>entry.sourceStartRef?.chunk===0&&entry.sourceStartRef.paragraph===31);
  assert.equal(cafe,17,'roadside-cafe playback position must remain stable');
  assert.equal(direction(flow[cafe-1]).location,'Автомобиль по дороге в Рейкьявик');
  assert.equal(direction(flow[cafe-1]).art?.file,'s02-van-group-batch2.webp');
  for(const entry of flow.slice(cafe)){
    const shot=direction(entry);
    assert.equal(shot.location,'Придорожное кафе');
    assert.equal(shot.art?.file,'s02-roadside-cafe-group.webp');
    assert.deepEqual(shot.requiredCast,cast);
    assert.deepEqual(stageCastForPresentation(shot),cast);
  }
});

test('S02 choice variants preserve cafe visual continuity and no car-location contradiction',()=>{
  for(const first of ['A','B'])for(const second of ['A','B']){
    const selected={...choices,'S02-C90':first,'S02-C91':second};
    const flow=compileInteractivePlayback(scene,selected,'ru');
    const cafe=flow.findIndex(entry=>entry.sourceStartRef?.chunk===0&&entry.sourceStartRef.paragraph===31);
    assert.ok(cafe>=0,`cafe cue missing for ${first}/${second}`);
    for(const entry of flow.slice(cafe)){
      const text=entry.text??entry.question??'';
      assert.doesNotMatch(text,/в машине|in the car/iu,`car-location text leaked after cafe cue for ${first}/${second}`);
      assert.deepEqual(direction(entry,selected).requiredCast,cast);
    }
  }
});

test('focal stage contracts separate authored presence from required visible cast',()=>{
  const scene50=literarySeason.scenes.find(item=>item.id==='S50');
  const flow=compileInteractivePlayback(scene50,{},'ru');
  const shot=visualAt('S50',flow[0],{},stageForScene('S50',{}).cast);
  const contract=visualCastContract(shot,{actualVisibleCast:['alice','eric']});
  assert.deepEqual(contract.authoredCast,['alice','eric']);
  assert.deepEqual(contract.physicallyPresentCast,['alice','eric']);
  assert.deepEqual(contract.requiredVisibleCast,['alice','eric']);
  assert.deepEqual(contract.actualVisibleCast,['alice','eric']);
  assert.deepEqual(contract.offscreenAllowedCast,[]);
});

test('S18 reframe does not promote legacy full-group metadata to a visible-cast defect',()=>{
  const scene18=literarySeason.scenes.find(item=>item.id==='S18');
  const flow=compileInteractivePlayback(scene18,{},'ru');
  const shot=visualAt('S18',flow[0],{},stageForScene('S18',{}).cast);
  const contract=visualCastContract(shot,{actualVisibleCast:stageCastForPresentation(shot)});
  assert.deepEqual(shot.requiredCast,['alice','eric','nick','damir']);
  assert.deepEqual(contract.requiredVisibleCast,['alice','eric']);
  assert.deepEqual(contract.actualVisibleCast,['alice','eric']);
});

test('CG cast contract requires visual evidence instead of DOM sprites',()=>{
  const direction={cast:['alice','eric'],requiredCast:['alice','eric'],art:{type:'cg',presentation:'cinematic',file:'s23-eric-harbor-plan.webp'}};
  const contract=visualCastContract(direction,{cgVisualEvidence:{status:'PASS',actualVisibleCast:['alice','eric']}});
  assert.deepEqual(contract.actualVisibleCast,['alice','eric']);
  assert.equal(contract.visualEvidence.status,'PASS');
  assert.equal(contract.domCastApplicable,false);
});

test('group detector ignores folded-four wording and marks remote participants offscreen',()=>{
  assert.equal(groupSemanticSignal('Он достал карту, сложенную вчетверо.'),null);
  assert.deepEqual(groupSemanticSignal('Пока все четверо не ответили по видеосвязи.'),{kind:'group-reference',count:4});
});
