import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { initYandexPlatform, isLocalDevelopment, normalizeYandexLocale, requestedQaLocale, resetYandexSdkForTests } from '../../src/yandex-sdk.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');

function harness({lang='en-US',loadFails=false,cloud=null,cloudReadFails=false,cloudWriteFails=false,preloadedYaGames=false}={}) {
  const calls={init:0,ready:0,start:0,stop:0,getPlayer:0,getData:0,setData:0,append:0,ad:0},listeners={}; let adCallbacks=null;
  const player={async getData(){calls.getData++;if(cloudReadFails)throw Error('CLOUD_READ_FAILED');return cloud;},async setData(){calls.setData++;if(cloudWriteFails)throw Error('CLOUD_WRITE_FAILED');}};
  const ysdk={environment:{i18n:{lang}},features:{LoadingAPI:{ready(){calls.ready++;}},GameplayAPI:{start(){calls.start++;},stop(){calls.stop++;}}},adv:{showFullscreenAdv({callbacks}){calls.ad++;adCallbacks=callbacks;}},async getPlayer(){calls.getPlayer++;return player;},on(n,f){listeners[n]=f;},off(n){delete listeners[n];}};
  const window={};
  const YaGames={init:async()=>{calls.init++;return ysdk;}};
  if(preloadedYaGames)window.YaGames=YaGames;
  const document={head:{append(script){calls.append++;queueMicrotask(()=>{if(loadFails)script.error();else{window.YaGames=YaGames;script.load();}});}},querySelector(){return null;},createElement(){const h={};return{dataset:{},addEventListener(n,f){h[n]=f;},set src(v){this._src=v;},load:()=>h.load(),error:()=>h.error()};}};
  return {calls,listeners,document,window,closeAd(){adCallbacks?.onClose();},failAd(){adCallbacks?.onError();}};
}
test('language contract only exposes ru/en and QA override is local-only',()=>{
  assert.equal(normalizeYandexLocale('ru-RU'),'ru');assert.equal(normalizeYandexLocale('de'),'en');
  assert.equal(requestedQaLocale({protocol:'http:',hostname:'localhost',search:'?lang=en'}),'en');
  assert.equal(requestedQaLocale({protocol:'https:',hostname:'example.com',search:'?lang=ru'}),null);
  assert.equal(isLocalDevelopment({protocol:'https:',hostname:'example.com'}),false);
});
test('production HTML loads the official SDK before the application module',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const sdk=html.indexOf('<script src="/sdk.js"></script>');
  const app=html.indexOf('<script type="module" src="/src/entry.js"></script>');
  assert.ok(sdk>=0,'production HTML must explicitly load /sdk.js');
  assert.ok(sdk<app,'official SDK must load before the application module');
});
test('SDK success: init once, Game Ready once, lifecycle tracks pause and menu',async()=>{
  resetYandexSdkForTests();const events=[],h=harness({lang:'ru-RU'});const p=await initYandexPlatform({...h,onDiagnostic:event=>events.push(`${event.area}:${event.status}`),location:{protocol:'https:',hostname:'example.com',search:''}});
  assert.equal(p.locale,'ru');assert.equal(h.calls.init,1);assert.equal(h.calls.getPlayer,1);assert.deepEqual(events.slice(0,4),['sdk:initialized','language:resolved','player:ready','cloud-read:success']);assert.equal(p.markInteractiveReady(),true);assert.equal(p.markInteractiveReady(),false);assert.equal(h.calls.ready,1);
  p.setGameplayActive(true);p.setGameplayActive(true);assert.equal(h.calls.start,1);h.listeners.game_api_pause();assert.equal(h.calls.stop,1);h.listeners.game_api_resume();assert.equal(h.calls.start,2);p.setGameplayActive(false);assert.equal(h.calls.stop,2);
});
test('preloaded production SDK initializes once without injecting a duplicate script',async()=>{
  resetYandexSdkForTests();const h=harness({preloadedYaGames:true});const p=await initYandexPlatform({...h,location:{protocol:'https:',hostname:'games.yandex.ru',search:''}});
  assert.equal(p.mode,'yandex');assert.equal(h.calls.append,0);assert.equal(h.calls.init,1);
});
test('cloud read/write and diagnostics are observable',async()=>{
  resetYandexSdkForTests();const events=[],h=harness({cloud:{key:'value'}});const p=await initYandexPlatform({...h,cloudKey:'key',onDiagnostic:e=>events.push(e),location:{protocol:'https:',hostname:'example.com',search:''}});
  assert.equal(await p.save({sceneId:'S01'}),true);assert.equal(h.calls.getData,1);assert.equal(h.calls.setData,1);assert.ok(events.some(x=>x.area==='cloud-read'&&x.status==='success'));assert.ok(events.some(x=>x.area==='cloud-write'&&x.status==='success'));
});
test('SDK failure falls back locally without a failing request and fails explicitly elsewhere',async()=>{
  resetYandexSdkForTests();let h=harness({loadFails:true});let p=await initYandexPlatform({...h,location:{protocol:'http:',hostname:'localhost',search:'?lang=en'}});assert.equal(p.mode,'local-fallback');assert.equal(p.locale,'en');assert.equal(p.qaLocaleOverride,'en');assert.equal(h.calls.append,0);
  resetYandexSdkForTests();h=harness({loadFails:true});await assert.rejects(()=>initYandexPlatform({...h,location:{protocol:'https:',hostname:'cdn.example',search:'?lang=ru'}}),/YANDEX_RUNTIME_SDK_REQUIRED/);
});
test('production SDK locale is authoritative and unsupported locales fall back deterministically',async()=>{
  resetYandexSdkForTests();const h=harness({lang:'de-DE'});const p=await initYandexPlatform({...h,location:{protocol:'https:',hostname:'games.yandex.ru',search:'?lang=ru'}});
  assert.equal(p.mode,'yandex');assert.equal(p.locale,'en');assert.equal(p.qaLocaleOverride,null);
  const local=await initYandexPlatform({location:{protocol:'file:',hostname:'',search:'?lang=invalid'},window:{}});assert.equal(local.locale,'ru');
});
test('cloud failures stay observable and ad lifecycle never leaves gameplay active',async()=>{
  resetYandexSdkForTests();const events=[],h=harness({cloudReadFails:true,cloudWriteFails:true});const p=await initYandexPlatform({...h,onDiagnostic:event=>events.push(event),location:{protocol:'https:',hostname:'games.yandex.ru',search:''}});
  p.setGameplayActive(true);assert.equal(h.calls.start,1);const ad=p.showFullscreenAd();assert.equal(h.calls.stop,1);h.closeAd();assert.equal(await ad,true);assert.equal(h.calls.start,2);
  assert.equal(await p.save({sceneId:'S26'}),false);assert.ok(events.some(event=>event.area==='cloud-read'&&event.status==='failed'));assert.ok(events.some(event=>event.area==='cloud-write'&&event.status==='failed'));
  p.setGameplayActive(false);h.listeners.game_api_pause();h.listeners.game_api_resume();assert.equal(h.calls.start,2);
});
