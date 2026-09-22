import test from 'node:test';
import assert from 'node:assert/strict';
import { releasePreflight } from '../../tools/release/preflight.mjs';
test('ten-episode game and four endings exist, but publishing remains fail-closed until all RC gates pass',()=>{
 const result=releasePreflight();
 assert.equal(result.status,'BLOCKED');
 assert.equal(result.releaseCandidateReady,false);
 assert.equal(result.literaryEpisodesPlayable,10);
 assert.equal(result.literarySceneCount,66);
 assert.equal(result.defaultEdition,'new-ten-episode');
 assert.deepEqual(Object.values(result.routeSamples).map(x=>x.lastScene),['S44','S45','S46','S47']);
 for(const code of ['DURATION_NOT_MET','ART_COVERAGE_NOT_ACCEPTED','LOCALIZATION_NOT_VERIFIED','EXTERNAL_YANDEX_EVIDENCE','STARTER_KIT_DRIFT','FINAL_QA_MISSING']){
   assert.ok(result.blockers.some(x=>x.code===code),`Missing required blocker ${code}`);
 }
 for(const code of ['OLD_RUNTIME','UNWRITTEN_EPISODES','LITERARY_RUNTIME_INCOMPLETE','NEW_SEASON_NOT_DEFAULT']){
   assert.equal(result.blockers.some(x=>x.code===code),false,`Resolved blocker remains: ${code}`);
 }
});
