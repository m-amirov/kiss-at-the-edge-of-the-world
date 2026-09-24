const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const root = 'http://127.0.0.1:4173/literary.html';
const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const out = path.resolve('output/playwright/s17-s21-s61-runtime-2026-09-24');
const evidence = path.resolve('artifacts/evidence/s17-s21-s61-runtime');
fs.mkdirSync(out, { recursive: true }); fs.mkdirSync(evidence, { recursive: true });
const viewports = [{name:'1920x900',width:1920,height:900},{name:'390x844',width:390,height:844},{name:'360x640',width:360,height:640}];
const events = [
  ['S17','s17-hofn-guesthouse',{'S17-C2':'A'}],
  ['S19','s19-hofn-pool',{'S17-C2':'B','S19-C1':'A','S19-C2':'A'}],
  ['S20','s20-hofn-damir-kitchen',{'S17-C2':'C','S20-C1':'A'}],
  ['S21','s21-alice-hofn-room',{'S17-C2':'D','S21-C1':'A'}],
  ['S61','s61-hofn-streets',{'S17-C2':'D','S21-C1':'A'}]
];
const key = 'kiss-at-the-edge-of-the-world:literary-draft:v1';
async function inspect(page) { return page.evaluate(() => {
  const p=document.querySelector('.literary-picture'), i=p?.querySelector('img'), r=i?.getBoundingClientRect();
  return {sceneId:document.querySelector('.chapter-index')?.textContent?.match(/S\d+/)?.[0]??null,visualEventId:p?.dataset.visualBeat??null,asset:i?.dataset.asset??null,desktopAsset:i?.dataset.desktopAsset??null,presentationMode:document.querySelector('#literary-app')?.dataset.presentation??null,stageSprites:document.querySelectorAll('.scene-stage .stage-character').length,naturalWidth:i?.naturalWidth??0,naturalHeight:i?.naturalHeight??0,imageRect:r&&{x:r.x,y:r.y,width:r.width,height:r.height},overflow:{body:document.body.scrollWidth>document.body.clientWidth,html:document.documentElement.scrollWidth>document.documentElement.clientWidth},controls:[...document.querySelectorAll('button')].filter(b=>b.offsetParent).map(b=>({text:b.textContent.trim(),disabled:b.disabled}))};
}); }
async function capture(scene, beat, choices, vp) {
  const browser=await chromium.launch({headless:false,executablePath:chrome});
  const page=await browser.newPage({viewport:{width:vp.width,height:vp.height}}); page.setDefaultTimeout(5000);
  const errors=[],failed=[]; page.on('console',m=>m.type()==='error'&&errors.push(m.text())); page.on('pageerror',e=>errors.push(String(e))); page.on('requestfailed',r=>failed.push(`${r.url()} :: ${r.failure()?.errorText||'failed'}`));
  await page.addInitScript(({key,scene,choices})=>localStorage.setItem(key,JSON.stringify({schemaVersion:3,sceneId:scene,position:0,choices,finished:false,visited:[scene],runId:'qa',revision:0})),{key,scene,choices});
  await page.goto(root,{waitUntil:'domcontentloaded'}); await page.getByRole('button',{name:/Продолжить/}).click();
  await page.waitForFunction(({scene,beat})=>document.querySelector('.chapter-index')?.textContent.includes(scene)&&document.querySelector('.literary-picture')?.dataset.visualBeat===beat,{scene,beat},{timeout:5000});
  await page.waitForFunction(()=>{const i=document.querySelector('.literary-picture img');return !i||i.complete&&i.naturalWidth>0},{timeout:5000});
  await page.waitForTimeout(1000);
  const s=await inspect(page); const file=path.join(out,`${vp.name}-${beat}.png`); await page.screenshot({path:file,fullPage:false});
  const record={sceneId:scene,expectedVisualEventId:beat,viewport:`${vp.width}x${vp.height}`,screenshot:file,...s,errors,failed}; fs.writeFileSync(path.join(evidence,`${vp.name}-${beat}.json`),JSON.stringify(record,null,2)); await browser.close(); return record;
}
(async()=>{const all=[];for(const [scene,beat,choices] of events)for(const vp of viewports)all.push(await capture(scene,beat,choices,vp));fs.writeFileSync(path.join(evidence,'run.json'),JSON.stringify({head:require('child_process').execSync('git rev-parse HEAD').toString().trim(),browser:'native Windows Chrome',url:root,records:all},null,2));console.log(`S17_S21_S61_BROWSER_QA_OK ${all.length}`)})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
