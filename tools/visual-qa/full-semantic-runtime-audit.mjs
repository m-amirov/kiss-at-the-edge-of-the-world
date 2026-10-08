#!/usr/bin/env node
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {literarySeason} from '../../src/literary-season-data.js';
import {literarySaveKey} from '../../src/literary-engine.js';
import {compileInteractivePlayback} from '../../src/literary-pacing.js';
import {stageForScene, stageCastForPresentation} from '../../src/literary-stage.js';
import {visualAt} from '../../src/literary-visual-directions.js';
import {castMatches, groupSemanticSignal, visualCastContract} from '../../src/literary-visual-contract.js';

const {chromium}=await import(pathToFileURL('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const root=process.cwd();
const baseUrl=process.env.LITERARY_QA_URL??'http://127.0.0.1:4173/literary.html?qa=full-semantic-runtime-audit';
const evidenceFile=process.env.LITERARY_QA_EVIDENCE??'artifacts/evidence/full-semantic-runtime-audit-2026-10-08.json';
const screenshotDir=process.env.LITERARY_QA_SCREENSHOTS??'artifacts/evidence/s02-semantic-runtime-2026-10-08';
const cgEvidenceFile=process.env.LITERARY_QA_CG_EVIDENCE??'artifacts/evidence/cg-cast-pixel-evidence-2026-10-08.json';
const sourceHead=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const scenes=new Map(literarySeason.scenes.map(scene=>[scene.id,scene]));
const routeCodes={eric:'A',nick:'B',damir:'C',alice:'D'};
const viewports={mobile:{width:390,height:844},smallMobile:{width:360,height:640},desktop:{width:1920,height:900}};
const clone=value=>JSON.parse(JSON.stringify(value));
const setOf=values=>new Set(values??[]);
const names={
  alice:['Алиса','Alice'],
  nick:['Ник','Nick'],
  eric:['Эрик','Eric'],
  damir:['Дамир','Damir']
};
const explicitSpeech=/\b(сказал|сказала|ответил|ответила|спросил|спросила|добавил|добавила|заметил|заметила|said|asked|replied|added|noted)\b/iu;
const actorSignals=(text,locale='ru')=>Object.entries(names).filter(([,forms])=>forms.some(form=>new RegExp(`(?:^|\\s)${form}(?:\\s|,|—|:)`,`iu`).test(text))&&explicitSpeech.test(text)).map(([id])=>id);
const allAuthoredChoiceIds=[...new Set(literarySeason.scenes.flatMap(scene=>scene.chunks.map(chunk=>chunk.title.match(/(S\d{2}-C\d+)/)?.[1]).filter(Boolean)))];
const defaultChoices=Object.fromEntries(allAuthoredChoiceIds.map(id=>[id,'A']));
let cgCastEvidenceByAsset=new Map();
try {
  const payload=JSON.parse(fsSync.readFileSync(path.join(root,cgEvidenceFile),'utf8'));
  cgCastEvidenceByAsset=new Map((payload.entries??[]).map(item=>[item.asset,item]));
} catch {}

function enumerateVariants(scene,routeCode){
  const seed={...defaultChoices,'S17-C2':routeCode,'S26-C1':routeCode};
  const variants=[];const seen=new Set();
  function visit(choices){
    const flow=compileInteractivePlayback(scene,choices,'ru');
    const pending=flow.find(entry=>entry.type==='choice'&&!choices[entry.id]);
    if(!pending){
      const key=JSON.stringify(choices);
      if(!seen.has(key)){seen.add(key);variants.push({choices:clone(choices),flow});}
      return;
    }
    for(const option of pending.options)visit({...choices,[pending.id]:option.code});
  }
  visit(seed);
  return variants;
}

function defect(code,severity,message,details={}){return {code,severity,message,...details};}
function validateRow({sceneId,entry,trace,dom,position}){
  const defects=[];const required=setOf(trace.requiredVisibleCast??trace.requiredCast);const visible=setOf(trace.actualVisibleCast??trace.visibleCast);
  const castEvidenceAvailable=trace.artType!=='cg'||trace.visualEvidence?.status==='PASS';
  if(!trace.location||!trace.time)defects.push(defect('MISSING_LOCATION_TIME','P1','Runtime trace lacks location or time metadata'));
  if(trace.artType!=='cg'&&!trace.actualVisibleCast?.length)defects.push(defect('VISIBLE_CAST_EMPTY','P0','Displayed page has no actualVisibleCast', {position}));
  if(castEvidenceAvailable&&required.size&&(!trace.actualVisibleCast?.length||!castMatches([...required],[...visible])))defects.push(defect('DISPLAYED_CAST_DIFFERS_REQUIRED','P1','Runtime actualVisibleCast does not satisfy requiredVisibleCast',{requiredVisibleCast:[...required],actualVisibleCast:[...visible],position}));
  if(trace.artType==='cg'&&dom.stageCount>0)defects.push(defect('CG_STAGE_OVERLAY','P1','Cinematic CG has a live sprite stage overlay',{stageCount:dom.stageCount,position}));
  if(trace.artType&&(!dom.imageLoaded||dom.imageWidth<1||dom.imageHeight<1))defects.push(defect('RUNTIME_ART_NOT_LOADED','P0','Runtime art image did not load',{position,asset:trace.background}));
  if(!dom.noOverflow)defects.push(defect('RUNTIME_OVERFLOW','P1','Runtime page overflows viewport',{position}));
  for(const actor of actorSignals(entry?.text??''))if(castEvidenceAvailable&&!visible.has(actor))defects.push(defect('ACTIVE_ACTOR_ABSENT','P0','Explicit speaker/action actor is not visible',{actor,position,text:entry.text}));
  const text=entry?.text??'';
  if(sceneId==='S02'&&trace.sourceStartRef?.chunk===0&&trace.sourceStartRef.paragraph>=31&&/\b(?:в машине|в автомобиль|in the car|inside the car)\b/iu.test(text))defects.push(defect('LOCATION_TEXT_CONTRADICTION','P1','S02 cafe-page text still describes the group as being in the car',{position,text}));
  const groupSignal=groupSemanticSignal(text);
  if(groupSignal?.kind==='physical-group'&&visible.size<groupSignal.count)defects.push(defect('TEXT_GROUP_NOT_VISIBLE','P1','Text describes a co-located group larger than actualVisibleCast',{position,text,actualVisibleCast:[...visible],groupSignal}));
  return defects;
}

async function setState(page,state){
  await page.goto(baseUrl,{waitUntil:'domcontentloaded'});
  await page.evaluate(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key:literarySaveKey,value:state});
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>Boolean(window.__LITERARY_QA__));
  const resume=page.getByRole('button',{name:/Продолжить|Continue|Новая игра|New game/}).first();
  if(await resume.count())await resume.click();
  await page.waitForFunction(()=>{const image=document.querySelector('.literary-picture img');return !image||Boolean(image.complete&&image.naturalWidth>0)},{timeout:10000}).catch(()=>{});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.waitForTimeout(420);
}

async function inspect(page){
  return page.evaluate(()=>{
    const qa=window.__LITERARY_QA__;const saved=qa.getState();const flow=qa.getFlow();const entry=flow[saved.position]??null;const trace=qa.getRuntimeTrace();const image=document.querySelector('.literary-picture img');
    const stage=[...document.querySelectorAll('.scene-stage .stage-character')].map(node=>[...node.classList].find(name=>name.startsWith('stage-')&&name!=='stage-character')?.slice(6)).filter(Boolean);
    return {saved,entry,trace,dom:{stageCount:stage.length,stageCast:stage,imageLoaded:Boolean(image?.complete&&image.naturalWidth>0),imageWidth:image?.naturalWidth??0,imageHeight:image?.naturalHeight??0,noOverflow:document.documentElement.scrollWidth<=window.innerWidth&&document.documentElement.scrollHeight<=window.innerHeight&&document.body.scrollWidth<=window.innerWidth&&document.body.scrollHeight<=window.innerHeight}};
  });
}

async function auditVariant(page,sceneId,variant,route,viewportName,active){
  const scene=sceneById(sceneId);const initial={schemaVersion:3,sceneId,position:0,choices:variant.choices,finished:false,visited:[sceneId],runId:`semantic-${sceneId}-${route}-${viewportName}-${Date.now()}`,revision:0};
  await setState(page,initial);const rows=[];const defects=[];let steps=0;const flow=variant.flow;
  while(steps<flow.length+3){
    const snapshot=await inspect(page);const entry=snapshot.entry;
    if(snapshot.saved.sceneId!==sceneId)break;
    if(!entry)break;
    const cgEvidence=snapshot.trace.artType==='cg'?cgCastEvidenceByAsset.get(snapshot.trace.background):null;
    const runtimeTrace=snapshot.trace.artType==='cg'&&cgEvidence?.status==='PASS'
      ? {...snapshot.trace,actualVisibleCast:cgEvidence.actualVisibleCast,visualEvidence:cgEvidence}
      : snapshot.trace;
    const row={scene:sceneId,route,viewport:viewportName,position:snapshot.saved.position,displayedPosition:runtimeTrace.displayedPosition,entryType:entry.type,entryId:runtimeTrace.entryId,sourceStartRef:runtimeTrace.sourceStartRef,sourceEndRef:runtimeTrace.sourceEndRef,text:entry.text??entry.question??'',location:runtimeTrace.location,time:runtimeTrace.time,authoredCast:runtimeTrace.authoredCast,physicallyPresentCast:runtimeTrace.physicallyPresentCast??runtimeTrace.authoredCast,requiredVisibleCast:runtimeTrace.requiredVisibleCast??runtimeTrace.requiredCast,actualVisibleCast:runtimeTrace.actualVisibleCast??runtimeTrace.visibleCast,offscreenAllowedCast:runtimeTrace.offscreenAllowedCast??[],visualEvidence:runtimeTrace.visualEvidence??null,requiredCast:runtimeTrace.requiredCast,visibleCast:runtimeTrace.visibleCast,background:runtimeTrace.background,artType:runtimeTrace.artType,actorSignals:actorSignals(entry.text??''),runtimeStageCast:snapshot.dom.stageCast,imageLoaded:snapshot.dom.imageLoaded,noOverflow:snapshot.dom.noOverflow};
    rows.push(row);const rowDefects=validateRow({sceneId,entry,trace:runtimeTrace,dom:snapshot.dom,position:snapshot.saved.position});
    for(const item of rowDefects)defects.push({...item,scene:sceneId,route,viewport:viewportName,position:snapshot.saved.position});
    if(entry.type!=='page')defects.push(defect('UNRESOLVED_RUNTIME_CHOICE','P0','Finalized variant still rendered a choice screen',{scene:sceneId,position:snapshot.saved.position,entryId:entry.id}));
    const stage=page.locator('[data-stage-advance]');if(!await stage.count())break;
    await stage.click();steps++;
  }
  active.rows.push(...rows);active.defects.push(...defects);active.variantCount++;
}

function auditSourceVariant(sceneId,variant,route,active){
  const scene=sceneById(sceneId);
  for(const [position,entry] of variant.flow.entries()){
    const authoredCast=stageForScene(sceneId,variant.choices).cast;
    const direction=visualAt(sceneId,entry,variant.choices,authoredCast);
    const visibleCast=direction.art?.presentation==='cinematic'
      ? [...(direction.requiredCast?.length?direction.requiredCast:direction.cast??[])]
      : stageCastForPresentation(direction);
    const cgEvidence=direction.art?.type==='cg'?cgCastEvidenceByAsset.get(direction.art.file):null;
    const contract=visualCastContract(direction,{actualVisibleCast:visibleCast,cgVisualEvidence:cgEvidence});
    const row={scene:sceneId,route,position,entryType:entry.type,entryId:entry.id??null,sourceStartRef:entry.sourceStartRef??null,sourceEndRef:entry.sourceEndRef??null,text:entry.text??entry.question??'',location:direction.location,time:direction.time,authoredCast:contract.authoredCast,physicallyPresentCast:contract.physicallyPresentCast,requiredVisibleCast:contract.requiredVisibleCast,actualVisibleCast:contract.actualVisibleCast??visibleCast,offscreenAllowedCast:contract.offscreenAllowedCast,visualEvidence:contract.visualEvidence,physicalCast:authoredCast,requiredCast:direction.requiredCast??[],visibleCast,background:direction.art?.file??null,artType:direction.art?.type??null,actorSignals:actorSignals(entry.text??''),sourceAssetExists:direction.art?fsSync.existsSync(path.join(root,'assets',direction.art.type==='cg'?'cg':'backgrounds',direction.art.file)):true};
    active.sourceRows.push(row);active.sourcePlaybackPositionsChecked++;
    const rowDefects=validateRow({sceneId,entry,trace:{location:direction.location,time:direction.time,requiredVisibleCast:contract.requiredVisibleCast,actualVisibleCast:contract.actualVisibleCast??visibleCast,requiredCast:direction.requiredCast??[],visibleCast,visualEvidence:contract.visualEvidence,artType:direction.art?.type??null,background:direction.art?.file??null,sourceStartRef:entry.sourceStartRef},dom:{stageCount:0,imageLoaded:row.sourceAssetExists,imageWidth:row.sourceAssetExists?1:0,imageHeight:row.sourceAssetExists?1:0,noOverflow:true},position});
    for(const item of rowDefects)active.defects.push({...item,scene:sceneId,route,position,phase:'source'});
  }
}

function sceneById(id){const scene=scenes.get(id);if(!scene)throw new Error(`Unknown scene ${id}`);return scene;}

async function auditChoice(page,sceneId,variant,choiceId,optionCode,route,active){
  const choices={...variant.choices};delete choices[choiceId];const flow=compileInteractivePlayback(sceneById(sceneId),choices,'ru');const position=flow.findIndex(entry=>entry.type==='choice'&&entry.id===choiceId);if(position<0)return false;
  const initial={schemaVersion:3,sceneId,position,choices,finished:false,visited:[sceneId],runId:`choice-${sceneId}-${choiceId}-${optionCode}-${Date.now()}`,revision:0};
  await setState(page,initial);const before=await inspect(page);const buttons=page.locator('.choice-button');
  const expectedButtonCount=before.entry?.options?.length??0;const actualButtonCount=await buttons.count();
  if(before.trace.entryType!=='choice'||actualButtonCount!==expectedButtonCount){active.defects.push(defect('CHOICE_SCREEN_RUNTIME_MISMATCH','P0','Choice screen did not render as authored',{scene:sceneId,choiceId,position,entryType:before.trace.entryType,expectedButtonCount,buttonCount:actualButtonCount}));return false;}
  const index=before.entry.options.findIndex(option=>option.code===optionCode);await buttons.nth(index).click();const afterChoice=await inspect(page);
  if(afterChoice.saved.choices[choiceId]!==optionCode)active.defects.push(defect('CHOICE_RESULT_NOT_PERSISTED','P0','Runtime choice result was not persisted',{scene:sceneId,choiceId,optionCode}));
  active.choiceVariantsChecked++;return true;
}

async function captureS02(page,routeCode,choiceCode,viewportName,position,active){
  const variants=enumerateVariants(sceneById('S02'),routeCode);const variant=variants.find(item=>item.choices['S02-C91']===choiceCode)||variants[0];
  const initial={schemaVersion:3,sceneId:'S02',position,choices:variant.choices,finished:false,visited:['S01','S02'],runId:`s02-shot-${choiceCode}-${viewportName}-${position}-${Date.now()}`,revision:0};
  await setState(page,initial);const snapshot=await inspect(page);const filename=`s02-${choiceCode}-${viewportName}-p${String(position+1).padStart(2,'0')}.png`;const file=path.join(screenshotDir,filename);await page.screenshot({path:file,fullPage:false});
  active.screenshots.push({path:file,scene:'S02',choice:'S02-C91='+choiceCode,viewport:viewports[viewportName],position,displayedPosition:snapshot.trace.displayedPosition,visualBeat:snapshot.trace.visualBeat,location:snapshot.trace.location,visibleCast:snapshot.trace.visibleCast,background:snapshot.trace.background});
}

const active={rows:[],sourceRows:[],defects:[],screenshots:[],variantCount:0,sourceVariantCount:0,sourcePlaybackPositionsChecked:0,choiceVariantsChecked:0};
await fs.mkdir(path.dirname(evidenceFile),{recursive:true});await fs.mkdir(screenshotDir,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const context=await browser.newContext({viewport:viewports.mobile,hasTouch:true,isMobile:true});const page=await context.newPage();let currentDiagnostics=null;
page.on('pageerror',error=>currentDiagnostics?.errors.push(String(error)));page.on('console',message=>{if(message.type()==='error'&&!/Failed to load resource: the server responded with a status of 404 \(Not Found\)/u.test(message.text()))currentDiagnostics?.errors.push(message.text())});page.on('requestfailed',request=>{if(!/\/sdk\.js(?:$|\?)/u.test(request.url()))currentDiagnostics?.failed.push({url:request.url(),reason:request.failure()?.errorText??'failed'})});page.on('response',response=>{if(response.status()>=400&&!/\/sdk\.js(?:$|\?)/u.test(response.url()))currentDiagnostics?.failed.push({url:response.url(),status:response.status()})});
try{
  for(const [sceneId] of scenes){
    let runtimeVariants=null;
    for(const [route,routeCode] of Object.entries(routeCodes)){
      const variants=enumerateVariants(sceneById(sceneId),routeCode);active.sourceVariantCount+=variants.length;
      for(const variant of variants)auditSourceVariant(sceneId,variant,route,active);
      if(route==='eric')runtimeVariants=variants;
    }
    const route='eric';const variants=runtimeVariants??enumerateVariants(sceneById(sceneId),'A');const runtimeVariant=variants[0];currentDiagnostics={errors:[],failed:[]};await auditVariant(page,sceneId,runtimeVariant,route,'mobile',active);if(currentDiagnostics.errors.length||currentDiagnostics.failed.length)active.defects.push(defect('RUNTIME_DIAGNOSTIC_ERROR','P0','Browser reported runtime error or failed request',{scene:sceneId,route,errors:currentDiagnostics.errors,failed:currentDiagnostics.failed}));
    const choiceIds=[...new Set(variants.flatMap(variant=>Object.keys(variant.choices).filter(id=>id.startsWith(`${sceneId}-`))))];
    for(const choiceId of choiceIds){const choiceVariant=variants.find(variant=>variant.choices[choiceId])??runtimeVariant;const before={...choiceVariant.choices};delete before[choiceId];const pending=compileInteractivePlayback(sceneById(sceneId),before,'ru').find(entry=>entry.type==='choice'&&entry.id===choiceId);for(const option of pending?.options??[]){currentDiagnostics={errors:[],failed:[]};await auditChoice(page,sceneId,choiceVariant,choiceId,option.code,route,active);if(currentDiagnostics.errors.length||currentDiagnostics.failed.length)active.defects.push(defect('RUNTIME_DIAGNOSTIC_ERROR','P0','Browser reported runtime error or failed request during choice',{scene:sceneId,choiceId,optionCode:option.code,errors:currentDiagnostics.errors,failed:currentDiagnostics.failed}));}}
  }
  await context.close();
  for(const viewportName of ['desktop','mobile','smallMobile']){
    const next=await browser.newContext({viewport:viewports[viewportName],hasTouch:viewportName!=='desktop',isMobile:viewportName!=='desktop'});const shotPage=await next.newPage();
    for(const choiceCode of ['A','B']){const flow=compileInteractivePlayback(sceneById('S02'),{...defaultChoices,'S01-C1':'A','S02-C1':'A','S02-C90':'A','S02-C91':choiceCode});const cafe=flow.findIndex(entry=>entry.sourceStartRef?.chunk===0&&entry.sourceStartRef.paragraph===31);for(const position of [cafe-1,cafe,cafe+1])await captureS02(shotPage,'A',choiceCode,viewportName,position,active);}
    await next.close();
  }
} finally {await browser.close();}
const sceneIds=[...new Set(active.rows.map(row=>row.scene))];
const errors=active.defects.filter(item=>item.severity==='P0');const warnings=active.defects.filter(item=>item.severity!=='P0');
const evidence={schemaVersion:1,status:active.defects.length?'FAIL':'PASS',generatedAt:new Date().toISOString(),sourceHead,baseUrl,scenesChecked:sceneIds.length,expectedSceneCount:66,routesChecked:Object.keys(routeCodes),sourceRoutesChecked:Object.keys(routeCodes),runtimeRouteSeed:'eric (A) for one complete browser trace per scene; all four route seeds are covered by source-complete rows and full-route-semantic-2026-10-08.json',viewportAudit:'390x844 runtime trace for one complete variant per scene plus runtime choice boundaries; S02 screenshot matrix includes 1920x900, 390x844, 360x640',sourceVariantCount:active.sourceVariantCount,sourcePlaybackPositionsChecked:active.sourcePlaybackPositionsChecked,variantCount:active.variantCount,playbackPositionsChecked:active.rows.length,choiceVariantsChecked:active.choiceVariantsChecked,sourceRows:active.sourceRows,rows:active.rows,screenshots:active.screenshots,defects:active.defects,summary:{p0:errors.length,p1:warnings.filter(item=>item.severity==='P1').length,p2:warnings.filter(item=>item.severity==='P2').length,consoleOrRequestFailures:active.defects.filter(item=>item.code==='RUNTIME_DIAGNOSTIC_ERROR').length}};
await fs.writeFile(evidenceFile,JSON.stringify(evidence,null,2));console.log(JSON.stringify({status:evidence.status,sourceHead,scenesChecked:sceneIds.length,variantCount:active.variantCount,playbackPositionsChecked:active.rows.length,choiceVariantsChecked:active.choiceVariantsChecked,screenshotCount:active.screenshots.length,p0:errors.length,p1:warnings.filter(item=>item.severity==='P1').length,p2:warnings.filter(item=>item.severity==='P2').length,evidenceFile},null,2));
if(evidence.status!=='PASS')process.exitCode=1;
