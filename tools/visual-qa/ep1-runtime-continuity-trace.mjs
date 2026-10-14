import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { literarySaveKey } from '../../src/literary-engine.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const baseUrl=process.env.LITERARY_QA_URL??'http://127.0.0.1:4173/literary.html?qa=ep1-runtime-continuity';
const output=process.env.LITERARY_QA_EVIDENCE??path.join(root,'artifacts/evidence/ep1-runtime-continuity-trace.json');
const {chromium}=await import(pathToFileURL('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const sourceFiles=['literary.html','src/literary-player.js','src/literary-season-data.js','src/literary-pacing.js','src/literary-visual-directions.js'];
const workspaceHashes=Object.fromEntries(await Promise.all(sourceFiles.map(async file=>[file,sha(await fs.readFile(path.join(root,file)))])));
const seed=(position,choices={})=>({schemaVersion:3,sceneId:'S02',position,choices:{'S01-C1':'A','S02-C90':'A','S02-C91':'A','S02-C1':'A',...choices},finished:false,visited:['S01','S02'],runId:'ep1-runtime-trace',revision:1});
const traces=[];
const choiceBoundary=[];
function assertS02(trace,label){assert.equal(trace.sceneId,'S02',label);assert.match(trace.displayedPosition,/^\d+\/37$/,label);assert.ok(trace.sourceStartRef,label);assert.ok(['Автомобиль по дороге в Рейкьявик','Придорожное кафе'].includes(trace.location),label);}
async function trace(page,scenario,step){const value=await page.evaluate(()=>window.__LITERARY_QA__.getRuntimeTrace());assertS02(value,`${scenario}/${step}`);traces.push({scenario,step,...value});return value;}
async function rawTrace(page,scenario,step){const value=await page.evaluate(()=>window.__LITERARY_QA__.getRuntimeTrace());assert.equal(value.sceneId,'S02',`${scenario}/${step}`);assert.ok(value.sourceStartRef,`${scenario}/${step}`);choiceBoundary.push({scenario,step,...value});return value;}
async function load(page,state){await page.goto(baseUrl,{waitUntil:'domcontentloaded'});await page.evaluate(({key,value})=>{localStorage.clear();localStorage.setItem(key,JSON.stringify(value));},{key:literarySaveKey,value:state});await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:/Продолжить/}).click();}
async function captureWindow(page,scenario){for(let pos=22;pos<=28;pos++){await load(page,seed(pos));await trace(page,scenario,`position-${pos+1}`);}}
async function exerciseChoiceBoundary(page,first,second){
 const scenario=`G-choice-${first}-back-${second}`;
 const preChoice={schemaVersion:3,sceneId:'S02',position:24,choices:{'S01-C1':'A','S02-C90':'A','S02-C1':'A'},finished:false,visited:['S01','S02'],runId:`ep1-choice-${first}-${second}`,revision:1};
 await load(page,preChoice);
 const before=await rawTrace(page,scenario,'pre-choice');
 assert.equal(before.entryId,'S02-C91',scenario);
 assert.equal(before.entryType,'choice',scenario);
 assert.equal(before.choiceState['S02-C91'],undefined,scenario);
 assert.equal(before.location,'Придорожное кафе',scenario);
 assert.equal(before.background,'s02-roadside-cafe-group.webp',scenario);
 assert.deepEqual(before.visibleCast,['alice','eric','nick','damir'],scenario);
 assert.notEqual(before.platformMode,'yandex',scenario);
 await page.evaluate(key=>{
   const original=Storage.prototype.setItem;
   window.__EP1_SAVE_WRITES__={count:0};
   Storage.prototype.setItem=function(k,v){if(k===key)window.__EP1_SAVE_WRITES__.count++;return original.call(this,k,v);};
 },literarySaveKey);
 await page.locator('.choice-button').nth(first==='A'?0:1).click();
 const afterFirst=await rawTrace(page,scenario,`selected-${first}`);
 assert.equal(afterFirst.choiceState['S02-C91'],first,scenario);
 assert.match(afterFirst.displayedPosition,/^25\/37$/,scenario);
 assert.equal(afterFirst.location,'Придорожное кафе',scenario);
 assert.equal(afterFirst.background,'s02-roadside-cafe-group.webp',scenario);
 assert.deepEqual(afterFirst.visibleCast,['alice','eric','nick','damir'],scenario);
 assert.equal(await page.evaluate(()=>window.__EP1_SAVE_WRITES__.count),1,scenario);
 await page.getByRole('button',{name:/Назад/}).click();
 const rolledBack=await rawTrace(page,scenario,'rolled-back');
 assert.equal(rolledBack.displayedPosition,before.displayedPosition,scenario);
 assert.deepEqual(rolledBack.choiceState,before.choiceState,scenario);
 assert.equal(rolledBack.location,before.location,scenario);
 assert.equal(rolledBack.background,before.background,scenario);
 assert.equal(rolledBack.revision,afterFirst.revision,scenario);
 assert.equal(await page.evaluate(()=>window.__EP1_SAVE_WRITES__.count),1,scenario);
 await page.locator('.choice-button').nth(second==='A'?0:1).click();
 const afterSecond=await rawTrace(page,scenario,`reselected-${second}`);
 assert.equal(afterSecond.choiceState['S02-C91'],second,scenario);
 assert.notEqual(afterSecond.choiceState['S02-C91'],first,scenario);
 assert.notEqual(afterSecond.dialogueHash,afterFirst.dialogueHash,scenario);
 assert.equal(afterSecond.location,'Придорожное кафе',scenario);
 assert.equal(afterSecond.background,'s02-roadside-cafe-group.webp',scenario);
 assert.deepEqual(afterSecond.visibleCast,['alice','eric','nick','damir'],scenario);
 assert.equal(await page.evaluate(()=>window.__EP1_SAVE_WRITES__.count),2,scenario);
 await page.locator('[data-stage-advance]').click();
 const continued=await rawTrace(page,scenario,'continued-once');
 assert.equal(continued.displayedPosition,'26/37',scenario);
 assert.equal(continued.location,'Придорожное кафе',scenario);
 assert.equal(continued.background,'s02-roadside-cafe-group.webp',scenario);
 assert.deepEqual(continued.visibleCast,['alice','eric','nick','damir'],scenario);
}
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage();
 await page.goto(baseUrl,{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:/Новая игра/}).click();
 // A: linear runtime reaches the trace window using real stage/choice controls.
 for(let guard=0;guard<100;guard++){
  const current=await page.evaluate(()=>window.__LITERARY_QA__.getRuntimeTrace());
  if(current.sceneId==='S02'&&Number(current.displayedPosition.split('/')[0])>=23)break;
  if(current.entryType==='choice')await page.locator('.choice-button').first().click();
  else if(await page.locator('.reader-sheet > button.primary').count())await page.locator('.reader-sheet > button.primary').click();
  else await page.evaluate(()=>document.querySelector('.reader-sheet')?.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})));
 }
 for(let guard=0;guard<30;guard++){
  const current=await page.evaluate(()=>window.__LITERARY_QA__.getRuntimeTrace());
  if(current.displayedPosition.endsWith('/37'))break;
  if(current.entryType==='choice')await page.locator('.choice-button').first().click();
  else await page.evaluate(()=>document.querySelector('.reader-sheet')?.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})));
 }
 await trace(page,'A-new-game-linear','arrival');
 await captureWindow(page,'B-local-save-reload');
 await load(page,seed(22));await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:/Продолжить/}).click();await trace(page,'C-reload-neighbour','same-state');
 await page.locator('[data-stage-advance]').click();await trace(page,'D-close-reopen-resume','after-reopen');
 await load(page,seed(23));await page.locator('[data-stage-advance]').click();await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:/Продолжить/}).click();await trace(page,'E-advance-save-reload','after-reload');
 await load(page,seed(23));await page.locator('[data-stage-advance]').click();await page.getByRole('button',{name:/Назад/}).click();await page.locator('[data-stage-advance]').click();await trace(page,'F-back-forward','replayed');
 await exerciseChoiceBoundary(page,'A','B');
 await exerciseChoiceBoundary(page,'B','A');
 await captureWindow(page,'H-local-save-only');
 await context.close();
}finally{await browser.close();}
const cafe=traces.filter(item=>Number(item.displayedPosition.split('/')[0])>=18);
assert.ok(cafe.every(item=>item.location==='Придорожное кафе'), 'cafe positions must not resolve to car');
await fs.mkdir(path.dirname(output),{recursive:true});
await fs.writeFile(output,JSON.stringify({baseUrl,workspaceHashes,traces,choiceBoundary},null,2));
console.log(`EP1_RUNTIME_CONTINUITY_TRACE_PASS ${traces.length} ${choiceBoundary.length} ${output}`);
