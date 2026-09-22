#!/usr/bin/env node
/** Fail-closed RC preflight for the actual default ten-episode literary game. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { literarySeason } from '../../src/literary-season-data.js';
import { compileScenePlayback,nextLiteraryScene } from '../../src/literary-engine.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const exists=relative=>fs.existsSync(path.join(root,relative));
const words=text=>text.match(/[\p{L}\p{N}]+/gu)?.length??0;
const byId=new Map(literarySeason.scenes.map(scene=>[scene.id,scene]));
function samplePath(route){
 const c={},visited=[];let scene='S01',total=0;
 while(scene){
  if(visited.includes(scene)||!byId.has(scene))throw Error(`Invalid route: ${scene}`);
  visited.push(scene);let flow,guard=0;
  while(true){
   flow=compileScenePlayback(byId.get(scene),c);
   const prompt=flow.at(-1);
   if(prompt?.type!=='choice')break;
   const selected=prompt.id==='S17-C2'||prompt.id==='S26-C1'?route:prompt.options[0].code;
   if(!prompt.options.some(x=>x.code===selected))throw Error(`Invalid choice ${prompt.id}`);
   c[prompt.id]=selected;
   if(++guard>20)throw Error(`Stalled choice: ${scene}`);
  }
  total+=words(flow.filter(x=>x.type==='paragraph').map(x=>x.text).join(' '));
  scene=nextLiteraryScene(scene,c);
 }
 return {words:total,lastScene:visited.at(-1),sceneCount:visited.length,estimatedReadingMinutesAt230wpm:Math.round(total/230)};
}
export function releasePreflight(){
 const blockers=[];const block=(code,reason)=>blockers.push({code,reason});
 const rootIndex=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const entry=exists('src/entry.js')?fs.readFileSync(path.join(root,'src/entry.js'),'utf8'):'';
 if(!rootIndex.includes('/src/entry.js')||!entry.includes("import('./literary-player.js')"))block('NEW_SEASON_NOT_DEFAULT','Default index.html does not launch the ten-episode literary game.');
 if(literarySeason.episodes!==10||literarySeason.scenes.length!==66)block('LITERARY_RUNTIME_INCOMPLETE',`Found ${literarySeason.episodes} episodes / ${literarySeason.scenes.length} scenes; expected 10 / 66.`);
 const missing=[7,8,9,10].map(n=>`content/season-1-literary-episode-${String(n).padStart(2,'0')}.md`).filter(p=>!exists(p));
 if(missing.length)block('UNWRITTEN_EPISODES',`Missing late-season manuscripts: ${missing.join(', ')}`);
 let routes=null;
 try { routes=Object.fromEntries('ABCD'.split('').map((route,i)=>[['eric','nick','damir','alice'][i],samplePath(route)])); }
 catch(error){block('FULL_ROUTE_GRAPH_BROKEN',String(error.message));}
 if(routes){
  if(Object.values(routes).some(({lastScene},i)=>lastScene!==['S44','S45','S46','S47'][i]))block('ENDINGS_INCOMPLETE','A route did not finish at its own last scene.');
  if(Math.min(...Object.values(routes).map(x=>x.words))<48000)block('DURATION_NOT_MET','Full route contains fewer than 48,000 words and has no measured 4–6 hour interactive playthrough. Do not replace the approved season pacing target with a short playable ending.');
 }
 if(!exists('assets/asset-manifest.json'))block('MISSING_ASSET_MANIFEST','Manifest missing.');
 else{
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/asset-manifest.json'),'utf8'));
  if(manifest.gate!=='NEW_SEASON_ART_COVERAGE_ACCEPTED')block('ART_COVERAGE_NOT_ACCEPTED','New 10-episode scene-to-art mapping, generated location/character art and full desktop/mobile scene coverage have not been independently accepted.');
 }
 block('LOCALIZATION_NOT_VERIFIED','The ten-episode new edition has Russian prose; English Yandex draft text/screenshots and localization have not been validated.');
 block('EXTERNAL_YANDEX_EVIDENCE','Live Yandex SDK/cloud/ad/release media and moderation evidence for the new edition are unavailable offline.');
 block('STARTER_KIT_DRIFT','Existing Starter Kit self-test reports target status is modified. Resolve upstream discrepancy without bypassing the guard.');
 block('FINAL_QA_MISSING','Four real full-route timed browser playthroughs, full-scene mobile/desktop staging review and substantive independent Web High release audit are not complete.');
 return {status:blockers.length?'BLOCKED':'PASS',releaseCandidateReady:!blockers.length,newSeasonEpisodesPlanned:10,literaryEpisodesPlayable:literarySeason.episodes,literarySceneCount:literarySeason.scenes.length,defaultEdition:'new-ten-episode',legacyAvailableOnExplicitQuery:true,routeSamples:routes,blockers};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=releasePreflight();console.log(JSON.stringify(result,null,2));if(result.status!=='PASS')process.exitCode=1;
}
