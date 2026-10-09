import { runtimeAssetUrl } from './runtime-assets.js';

const settingsKey = 'kiss-at-the-edge-of-the-world:audio-settings:v1';

function readSettings(storage) {
  try {
    const saved = JSON.parse(storage?.getItem(settingsKey) || '{}');
    return { volume: Number.isFinite(saved.volume) ? Math.min(1, Math.max(0, saved.volume)) : 0.28, muted: Boolean(saved.muted) };
  } catch { return { volume: 0.28, muted: false }; }
}

export function createAudioDirector({ AudioClass = globalThis.Audio, storage = globalThis.localStorage, requestFrame = globalThis.requestAnimationFrame } = {}) {
  const settings = readSettings(storage);
  const raf = typeof requestFrame === 'function' ? requestFrame : null;
  const state = { playing: false, playPromise: null, pauseRequested: false };
  let currentCue = null;
  let currentAudio = null;
  let unlocked = false;
  let suspended = false;
  let unlockPromise = null;
  let transitionToken = 0;

  const persist = () => { try { storage?.setItem(settingsKey, JSON.stringify(settings)); } catch {} };
  const effectiveVolume = () => settings.muted ? 0 : settings.volume;
  const setAudioVolume = (value) => { if (currentAudio) currentAudio.volume = Math.min(1, Math.max(0, value)); };
  const createAudio = cue => {
    const audio = new AudioClass();
    audio.preload = 'auto';
    audio.setAttribute?.('aria-hidden', 'true');
    currentAudio = audio;
    applyCue(cue, false);
    return audio;
  };
  const applyCue = (cue, resetPosition) => {
    if (!currentAudio) return;
    currentAudio.src = runtimeAssetUrl(`audio/music/${cue.file}`);
    currentAudio.loop = Boolean(cue.loopable);
    if (currentAudio.dataset) currentAudio.dataset.musicCue = cue.cueId;
    if (resetPosition) currentAudio.currentTime = 0;
  };
  const pauseAudio = () => {
    if (!currentAudio) return;
    state.pauseRequested = true;
    state.playing = false;
    if (state.playPromise || currentAudio.paused !== true) currentAudio.pause?.();
  };
  const playAudio = () => {
    if (!currentAudio) return Promise.resolve(false);
    if (state.playPromise) return state.playPromise;
    if (state.playing || currentAudio.paused === false) { state.playing = true; return Promise.resolve(true); }
    state.pauseRequested = false;
    state.playing = true;
    let result;
    try { result = currentAudio.play(); } catch { state.playing = false; return Promise.resolve(false); }
    const promise = Promise.resolve(result).then(() => {
      if (state.pauseRequested) { currentAudio.pause?.(); state.playing = false; return false; }
      return true;
    }, () => { state.playing = false; return false; });
    state.playPromise = promise;
    promise.then(() => { if (state.playPromise === promise) state.playPromise = null; });
    return promise;
  };
  const fadeTo = (target, token, done) => {
    if (!currentAudio || token !== transitionToken) return;
    if (!raf) { setAudioVolume(target); done?.(); return; }
    const from = currentAudio.volume;
    const start = performance.now();
    const tick = now => {
      if (token !== transitionToken || !currentAudio) return;
      const progress = Math.min(1, Math.max(0, (now - start) / 180));
      const volume = from + (target - from) * progress;
      setAudioVolume(volume);
      if (progress < 1) raf(tick); else done?.();
    };
    raf(tick);
  };
  const switchCue = cue => {
    const token = ++transitionToken;
    const switchSource = () => {
      if (token !== transitionToken || !currentAudio) return;
      pauseAudio();
      applyCue(cue, true);
      setAudioVolume(0);
      if (suspended) { setAudioVolume(effectiveVolume()); return; }
      playAudio().then(started => {
        if (!started || token !== transitionToken) return;
        fadeTo(effectiveVolume(), token);
      });
    };
    if (!currentAudio) { createAudio(cue); switchSource(); return; }
    if (suspended) { switchSource(); return; }
    fadeTo(0, token, switchSource);
  };

  return {
    unlock() {
      if (!currentCue) return Promise.resolve(false);
      if (unlockPromise) return unlockPromise;
      suspended = false;
      unlocked = true;
      if (!currentAudio) createAudio(currentCue);
      setAudioVolume(effectiveVolume());
      unlockPromise = playAudio().then(started => {
        if (!started) unlocked = false;
        return started;
      }).finally(() => { unlockPromise = null; });
      return unlockPromise;
    },
    setCue(cue) {
      if (!cue || cue.cueId === currentCue?.cueId) return { changed: false, cueId: currentCue?.cueId ?? null };
      currentCue = cue;
      if (!unlocked) return { changed: true, cueId: cue.cueId, deferred: true };
      switchCue(cue);
      return { changed: true, cueId: cue.cueId };
    },
    pause() {
      suspended = true;
      ++transitionToken;
      pauseAudio();
      if (currentAudio && currentCue && currentAudio.dataset?.musicCue !== currentCue.cueId) applyCue(currentCue, true);
      setAudioVolume(effectiveVolume());
    },
    resume() {
      suspended = false;
      if (!unlocked || !currentAudio) return Promise.resolve(false);
      return playAudio();
    },
    setVolume(value) {
      settings.volume = Math.min(1, Math.max(0, Number(value) || 0));
      persist();
      setAudioVolume(effectiveVolume());
    },
    setMuted(value) {
      settings.muted = Boolean(value);
      persist();
      setAudioVolume(effectiveVolume());
    },
    getState() {
      return { cueId: currentCue?.cueId ?? null, unlocked, volume: settings.volume, muted: settings.muted, activeInstances: currentAudio ? 1 : 0 };
    }
  };
}
