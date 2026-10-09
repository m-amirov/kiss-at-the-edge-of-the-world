#!/usr/bin/env node
/** Fail-closed RC preflight for the actual default ten-episode literary game. */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { literarySeason } from '../../src/literary-season-data.js';
import { compileScenePlayback,nextLiteraryScene } from '../../src/literary-engine.js';
import { supportedLocales } from '../../src/localization.js';
import { inspectTargetStatus } from '../starter-kit/status-core.mjs';
import { verifyArtAcceptance } from './art-acceptance.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const exists=relative=>fs.existsSync(path.join(root,relative));
const words=text=>text.match(/[\p{L}\p{N}]+/gu)?.length??0;
const byId=new Map(literarySeason.scenes.map(scene=>[scene.id,scene]));
const sameLocaleSet=(left,right)=>left.length===right.length&&left.every(locale=>right.includes(locale));
function declaredLocalesFrom(gameSpec){return (gameSpec.match(/^\s*languages:\s*\[([^\]]+)\]/m)?.[1]??'').split(',').map(x=>x.trim().replace(/^['"]|['"]$/g,'')).filter(Boolean);}
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
 const defaultEntry=/\b(?:src|href)=["']\.\/src\/entry\.js["']/i.test(rootIndex);
 if(!defaultEntry||!entry.includes("import('./literary-player.js')"))block('NEW_SEASON_NOT_DEFAULT','Default index.html does not launch the ten-episode literary game.');
 if(literarySeason.episodes!==10||literarySeason.scenes.length!==66)block('LITERARY_RUNTIME_INCOMPLETE',`Found ${literarySeason.episodes} episodes / ${literarySeason.scenes.length} scenes; expected 10 / 66.`);
 const missing=[7,8,9,10].map(n=>`content/season-1-literary-episode-${String(n).padStart(2,'0')}.md`).filter(p=>!exists(p));
 if(missing.length)block('UNWRITTEN_EPISODES',`Missing late-season manuscripts: ${missing.join(', ')}`);
 let routes=null;
 try { routes=Object.fromEntries('ABCD'.split('').map((route,i)=>[['eric','nick','damir','alice'][i],samplePath(route)])); }
 catch(error){block('FULL_ROUTE_GRAPH_BROKEN',String(error.message));}
 if(routes){
  if(Object.values(routes).some(({lastScene},i)=>lastScene!==['S44','S45','S46','S47'][i]))block('ENDINGS_INCOMPLETE','A route did not finish at its own last scene.');
  if(Math.min(...Object.values(routes).map(x=>x.estimatedReadingMinutesAt230wpm))<=10)block('DURATION_NOT_MET','A playable route must contain more than ten minutes of primary content under Yandex requirement 2.9.');
 }
 const artAcceptance=verifyArtAcceptance({root});
 if(artAcceptance.status!=='PASS')block('ART_COVERAGE_NOT_ACCEPTED',`${artAcceptance.code}: ${artAcceptance.reason}`);
 const gameSpec=fs.readFileSync(path.join(root,'game-spec.yaml'),'utf8');
 const declaredLocales=declaredLocalesFrom(gameSpec);
 const runtimeLocales=[...supportedLocales];
 const videoEvidence=exists('artifacts/evidence/final-gameplay-videos.json')?JSON.parse(fs.readFileSync(path.join(root,'artifacts/evidence/final-gameplay-videos.json'),'utf8')):null;
 const localVideoLocales=new Set(videoEvidence?.videos?.map(video=>video.locale)??[]);
 if(!sameLocaleSet(declaredLocales,runtimeLocales))block('LOCALE_REGISTRY_MISMATCH',`Release locales [${declaredLocales.join(',')}] do not match runtime locales [${runtimeLocales.join(',')}].`);
 if(runtimeLocales.some(locale=>!localVideoLocales.has(locale)))block('LOCALIZATION_NOT_VERIFIED','Local release media evidence does not cover every supported runtime locale.');
 block('EXTERNAL_YANDEX_EVIDENCE','Live Yandex SDK/cloud/ad/release media and moderation evidence for the new edition are unavailable offline.');
 const starterKitStatus=inspectTargetStatus({sourceRoot:root,targetRoot:root});
 if(starterKitStatus.status!=='clean')block('STARTER_KIT_DRIFT',`Starter Kit target status is ${starterKitStatus.status}; resolve managed drift without bypassing the guard.`);
 const routeQaCandidates=[
  'artifacts/evidence/full-route-interaction-final-rc-2026-10-08.json',
  'artifacts/evidence/full-route-runtime-qa-2026-09-30.json'
 ];
 const routeQaPath=routeQaCandidates.find(candidate=>exists(candidate));
 const routeQa=routeQaPath?JSON.parse(fs.readFileSync(path.join(root,routeQaPath),'utf8')):null;
 const currentHead=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
 const routeQaPass=routeQa?.status==='PASS'&&routeQa.head===currentHead&&routeQa.results?.length===8&&routeQa.results.every(item=>item.ending===item.expectedEnding&&item.finished&&((item.softLocks===0)||(item.saveLoadChecked===true&&item.doubleAdvanceFailures===0))&&item.errors?.length===0&&item.failed?.length===0);
 if(!routeQaPass)block('FINAL_QA_MISSING','Fresh full-route browser evidence for all four routes and both required viewports is missing or does not match the audited HEAD.');
 return {status:blockers.length?'BLOCKED':'PASS',releaseCandidateReady:!blockers.length,newSeasonEpisodesPlanned:10,literaryEpisodesPlayable:literarySeason.episodes,literarySceneCount:literarySeason.scenes.length,defaultEdition:'new-ten-episode',legacyAvailableOnExplicitQuery:false,routeSamples:routes,artAcceptance,localeContract:{declaredLocales,runtimeLocales,releaseMediaLocales:[...localVideoLocales]},blockers};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=releasePreflight();console.log(JSON.stringify(result,null,2));if(result.status!=='PASS')process.exitCode=1;
}
