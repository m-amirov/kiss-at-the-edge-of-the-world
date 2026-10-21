import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { musicCues, musicCueBySceneId, musicCueForScene } from '../../src/music-cues.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('all declared cues have unique ids and every mapped scene resolves', () => {
  assert.equal(new Set(musicCues.map(c => c.cueId)).size, musicCues.length);
  for (const cue of musicCues) for (const sceneId of cue.sceneIds) assert.equal(musicCueForScene(sceneId), cue.cueId);
  assert.ok(Object.keys(musicCueBySceneId).length >= 60);
});

test('production audio files and cue metadata agree', () => {
  for (const cue of musicCues) {
    assert.ok(fs.existsSync(path.join(root, 'assets/audio/music', `${cue.cueId}.ogg`)), `missing ${cue.cueId}.ogg`);
    assert.ok(Number.isInteger(cue.seed));
  }
});

test('audio rights manifest binds every shipped OGG to its current SHA-256', () => {
  const rights = JSON.parse(fs.readFileSync(path.join(root, 'assets/provenance/rights-manifest.json'), 'utf8'));
  const entries = new Map(rights.assets.map(entry => [entry.path, entry]));
  for (const cue of musicCues) {
    const relative = `assets/audio/music/${cue.cueId}.ogg`;
    const entry = entries.get(relative);
    assert.match(entry?.sha256 ?? '', /^[A-F0-9]{64}$/);
    const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, relative))).digest('hex').toUpperCase();
    assert.equal(entry.sha256, actual, `rights manifest hash mismatch for ${relative}`);
  }
});

test('runtime uses semantic cues and release assets contain no generator artifacts', () => {
  const runtime = fs.readFileSync(path.join(root, 'src/literary-player.js'), 'utf8');
  assert.match(runtime, /musicCueForScene/);
  assert.match(runtime, /audioDirector\.setCue/);
  assert.doesNotMatch(runtime, /[A-Za-z]:\\|file:\/\//);
  const audioFiles = fs.readdirSync(path.join(root, 'assets/audio/music'));
  assert.ok(audioFiles.every(file => file.endsWith('.ogg')));
  assert.equal(audioFiles.some(file => /\.wav$|checkpoint|cache|\.safetensors$/i.test(file)), false);
});

test('cue transition policy is semantic and does not restart A -> A', async () => {
  const { createAudioDirector } = await import('../../src/audio-director.js');
  const instances = [];
  class FakeAudio { constructor(){ this.playCount=0; this.pauseCount=0; this.volume=0; this.dataset={}; instances.push(this); } play(){this.playCount++; return Promise.resolve();} pause(){this.pauseCount++;} setAttribute(){} }
  const director = createAudioDirector({ AudioClass: FakeAudio, storage: { getItem:()=>null, setItem:()=>{} }, requestFrame: null });
  const a = { cueId:'a', file:'a.ogg', loopable:true }; const b = { cueId:'b', file:'b.ogg', loopable:true };
  director.setCue(a); assert.equal(instances.length, 0); await director.unlock(); assert.equal(instances.length, 1);
  director.setCue(a); assert.equal(instances.length, 1); director.setCue(a); assert.equal(instances.length, 1);
  director.setCue(b); assert.equal(instances.length, 2); assert.equal(instances[0].pauseCount, 1); assert.equal(director.getState().activeInstances, 1);
});

test('audio settings persist and apply mute/volume', async () => {
  const store = new Map(); const storage = { getItem: k => store.get(k) ?? null, setItem: (k,v) => store.set(k,v) };
  const { createAudioDirector } = await import('../../src/audio-director.js');
  class FakeAudio { constructor(){this.volume=0;this.dataset={};} play(){return Promise.resolve();} pause(){} setAttribute(){} }
  const director = createAudioDirector({ AudioClass: FakeAudio, storage, requestFrame: null }); director.setVolume(.4); director.setMuted(true);
  assert.deepEqual(director.getState(), { cueId:null, unlocked:false, volume:.4, muted:true, activeInstances:0 });
  assert.ok(store.size === 1);
});

test('browser AudioDirector does not assign readonly HTMLAudioElement.dataset', async () => {
  const { createAudioDirector } = await import('../../src/audio-director.js');
  class BrowserLikeAudio {
    constructor() { this.volume = 0; this._dataset = {}; }
    get dataset() { return this._dataset; }
    set dataset(_value) { throw new TypeError('dataset is readonly'); }
    setAttribute() {}
    play() { return Promise.resolve(); }
    pause() {}
  }
  const director = createAudioDirector({ AudioClass: BrowserLikeAudio, storage: { getItem: () => null, setItem: () => {} }, requestFrame: null });
  director.setCue({ cueId: 'browser-like', file: 'browser-like.ogg', loopable: true });
  await assert.doesNotReject(() => director.unlock());
  assert.equal(director.getState().activeInstances, 1);
});

test('VK external audio uses configured HTTPS base without changing Yandex local path', async () => {
  const { createAudioDirector } = await import('../../src/audio-director.js');
  const sources = [];
  class FakeAudio {
    constructor(){ this.dataset = {}; this.volume = 0; sources.push(this); }
    setAttribute(){}
    play(){ return Promise.resolve(); }
    pause(){}
  }
  const storage = { getItem: () => null, setItem: () => {} };
  const cue = { cueId: 'main-theme', file: 'main-theme.ogg', loopable: true };
  const vk = createAudioDirector({ AudioClass: FakeAudio, storage, requestFrame: null, audioBaseUrl: 'https://example.org/preview/music/' });
  vk.setCue(cue);
  await vk.unlock();
  assert.equal(sources.at(-1).src, 'https://example.org/preview/music/main-theme.ogg');
  const yandex = createAudioDirector({ AudioClass: FakeAudio, storage, requestFrame: null });
  yandex.setCue(cue);
  await yandex.unlock();
  assert.equal(sources.at(-1).src, './assets/audio/music/main-theme.ogg');
});


test('menu tabs preserve the same music playback position', async () => {
  const runtime = fs.readFileSync(path.join(root, 'src/literary-player.js'), 'utf8');
  const menu = runtime.match(/function renderMenu\(\)\{([\s\S]*?)\n\}\nfunction renderStage/)?.[1] ?? '';
  assert.match(menu, /audioDirector\.setCue\(menuAudioCue\)/);
  assert.doesNotMatch(menu, /audioDirector\.pause\(\)/);
  assert.match(runtime, /const menuAudioCue=audioCueById\.get\('main-theme'\)/);
  const {createAudioDirector}=await import('../../src/audio-director.js');
  const instances=[];
  class FakeAudio {
    constructor(){this.volume=0;this.currentTime=0;this.dataset={};this.paused=true;this.plays=0;this.pauses=0;instances.push(this)}
    setAttribute(){}
    play(){this.plays++;this.paused=false;return Promise.resolve()}
    pause(){this.pauses++;this.paused=true}
  }
  const director=createAudioDirector({AudioClass:FakeAudio,storage:{getItem:()=>null,setItem:()=>{}},requestFrame:null,audioBaseUrl:'https://s3.twcstorage.ru/kiss-vk-audio-2026/music/'});
  const main={cueId:'main-theme',file:'main-theme.ogg',loopable:true};
  director.setCue(main);await Promise.all([director.unlock(),director.unlock()]);
  assert.equal(instances.length,1);
  const playing=instances[0], count=playing.plays;
  playing.currentTime=19.5;
  director.setCue(main);await director.resume();director.setCue(main);await director.resume();
  assert.equal(playing.plays,count,'menu switching must not call play() again');
  assert.equal(playing.currentTime,19.5,'menu switching must retain currentTime');
  assert.equal(playing.pauses,0,'menu switching must not pause');
  assert.equal(playing.src,'https://s3.twcstorage.ru/kiss-vk-audio-2026/music/main-theme.ogg');
});

test('restored Yandex audio director guards repeated unlock and preserves position', async () => {
  const {createAudioDirector}=await import('../../src/audio-director.js');
  const instances=[];
  class FakeAudio {
    constructor(){this.volume=0;this.dataset={};this.currentTime=0;this.paused=true;this.plays=0;this.pauses=0;instances.push(this)}
    setAttribute(){}
    play(){this.plays++;this.paused=false;return Promise.resolve()}
    pause(){this.pauses++;this.paused=true}
  }
  const director=createAudioDirector({AudioClass:FakeAudio,storage:{getItem:()=>null,setItem:()=>{}},requestFrame:null});
  const main={cueId:'main-theme',file:'main-theme.ogg',loopable:true};
  director.setCue(main);await Promise.all([director.unlock(),director.unlock(),director.unlock()]);
  assert.equal(instances.length,1);
  assert.equal(instances[0].plays,1);
  assert.equal(instances[0].src,'./assets/audio/music/main-theme.ogg');
  instances[0].currentTime=16.25;
  director.pause();director.pause();await director.resume();await director.resume();
  assert.equal(instances[0].currentTime,16.25);
  assert.equal(instances[0].plays,2);
});


test('fast gameplay-to-menu cue replacements cancel abandoned fades', async () => {
  const {createAudioDirector}=await import('../../src/audio-director.js');
  const instances=[],frames=[];
  class FakeAudio {
    constructor(){this.volume=0;this.currentTime=0;this.paused=true;this.dataset={};this.plays=0;this.pauses=0;instances.push(this)}
    setAttribute(){}
    play(){this.plays++;this.paused=false;return Promise.resolve()}
    pause(){this.pauses++;this.paused=true}
  }
  const director=createAudioDirector({AudioClass:FakeAudio,storage:{getItem:()=>null,setItem:()=>{}},requestFrame:fn=>{frames.push(fn);return frames.length}});
  const cue=id=>({cueId:id,file:id+'.ogg',loopable:true});
  director.setCue(cue('road'));await director.unlock();
  director.setCue(cue('cafe'));director.setCue(cue('main-theme'));
  for(const frame of frames.splice(0))frame(performance.now()+1000);
  await Promise.resolve();await Promise.resolve();
  assert.equal(instances.length,1);
  assert.equal(instances[0].src,'./assets/audio/music/main-theme.ogg');
  assert.equal(director.getState().cueId,'main-theme');
  assert.equal(director.getState().activeInstances,1);
});
