import test from 'node:test';
import assert from 'node:assert/strict';
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

test('runtime uses semantic cues and release assets contain no generator artifacts', () => {
  const runtime = fs.readFileSync(path.join(root, 'src/literary-player.js'), 'utf8');
  assert.match(runtime, /musicCueForScene/);
  assert.match(runtime, /audioDirector\.setCue/);
  const menu = runtime.match(/function renderMenu\(\)\{([\s\S]*?)\r?\n\}\r?\nfunction renderStage/)?.[1] ?? '';
  assert.match(menu, /audioDirector\.setCue\(menuAudioCue\)/);
  assert.doesNotMatch(menu, /audioDirector\.pause\(\)/);
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
  director.setCue(b); assert.equal(instances.length, 1); assert.equal(instances[0].pauseCount, 1); assert.equal(director.getState().activeInstances, 1);
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

test('unlock is idempotent and lifecycle resume preserves the current position', async () => {
  const { createAudioDirector } = await import('../../src/audio-director.js');
  const instances = [];
  class FakeAudio {
    constructor() { this.playCount = 0; this.pauseCount = 0; this.currentTime = 0; this.paused = true; this.volume = 0; this.dataset = {}; instances.push(this); }
    play() { this.playCount += 1; this.paused = false; return Promise.resolve(); }
    pause() { this.pauseCount += 1; this.paused = true; }
    setAttribute() {}
  }
  const director = createAudioDirector({ AudioClass: FakeAudio, storage: { getItem:()=>null, setItem:()=>{} }, requestFrame: null });
  director.setCue({ cueId:'main-theme', file:'main-theme.ogg', loopable:true });
  await Promise.all([director.unlock(), director.unlock(), director.unlock()]);
  assert.equal(instances.length, 1);
  assert.equal(instances[0].playCount, 1);
  instances[0].currentTime = 17.25;
  director.pause();
  assert.equal(instances[0].currentTime, 17.25);
  await director.resume();
  assert.equal(instances[0].currentTime, 17.25);
  assert.equal(instances[0].playCount, 2);
});

test('rapid cue replacement cancels the abandoned fade target', async () => {
  const { createAudioDirector } = await import('../../src/audio-director.js');
  const instances = [];
  const frames = [];
  class FakeAudio {
    constructor() { this.playCount = 0; this.pauseCount = 0; this.currentTime = 0; this.paused = true; this.volume = 0; this.dataset = {}; instances.push(this); }
    play() { this.playCount += 1; this.paused = false; return Promise.resolve(); }
    pause() { this.pauseCount += 1; this.paused = true; }
    setAttribute() {}
  }
  const director = createAudioDirector({ AudioClass: FakeAudio, storage: { getItem:()=>null, setItem:()=>{} }, requestFrame: callback => { frames.push(callback); return frames.length; } });
  const cue = id => ({ cueId:id, file:`${id}.ogg`, loopable:true });
  director.setCue(cue('a'));
  await director.unlock();
  director.setCue(cue('b'));
  director.setCue(cue('c'));
  await Promise.resolve();
  await Promise.resolve();
  for (const frame of frames.splice(0)) frame(performance.now() + 1000);
  assert.equal(instances.length, 1);
  assert.equal(instances[0].pauseCount, 1);
  assert.equal(director.getState().cueId, 'c');
  assert.equal(director.getState().activeInstances, 1);
});
