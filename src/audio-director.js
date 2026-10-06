const settingsKey = 'kiss-at-the-edge-of-the-world:audio-settings:v1';

function readSettings(storage) {
  try {
    const saved = JSON.parse(storage?.getItem(settingsKey) || '{}');
    return { volume: Number.isFinite(saved.volume) ? Math.min(1, Math.max(0, saved.volume)) : 0.28, muted: Boolean(saved.muted) };
  } catch { return { volume: 0.28, muted: false }; }
}

export function createAudioDirector({ AudioClass = globalThis.Audio, storage = globalThis.localStorage, requestFrame = globalThis.requestAnimationFrame } = {}) {
  const settings = readSettings(storage);
  let currentCue = null;
  let currentAudio = null;
  let unlocked = false;
  let transitionToken = 0;
  const persist = () => { try { storage?.setItem(settingsKey, JSON.stringify(settings)); } catch {} };
  const effectiveVolume = () => settings.muted ? 0 : settings.volume;
  const setAudioVolume = (audio, value) => { if (audio) audio.volume = Math.min(1, Math.max(0, value)); };
  const createAudio = (cue) => {
    const audio = new AudioClass();
    audio.src = `./assets/audio/music/${cue.file}`;
    audio.preload = 'auto';
    audio.loop = Boolean(cue.loopable);
    audio.setAttribute?.('aria-hidden', 'true');
    if (audio.dataset) audio.dataset.musicCue = cue.cueId;
    setAudioVolume(audio, effectiveVolume());
    return audio;
  };
  const fade = (from, to, token) => {
    if (!requestFrame) { setAudioVolume(from, 0); setAudioVolume(to, effectiveVolume()); from?.pause?.(); return; }
    const start = performance.now();
    const tick = now => {
      if (token !== transitionToken) return;
      const progress = Math.min(1, (now - start) / 260);
      setAudioVolume(from, effectiveVolume() * (1 - progress));
      setAudioVolume(to, effectiveVolume() * progress);
      if (progress < 1) requestFrame(tick); else { from?.pause?.(); setAudioVolume(from, 0); }
    };
    requestFrame(tick);
  };
  const unlock = async () => {
    unlocked = true;
    if (!currentCue) return false;
    if (!currentAudio) currentAudio = createAudio(currentCue);
    try { await currentAudio.play(); return true; } catch { return false; }
  };
  return {
    unlock,
    setCue(cue) {
      if (!cue || cue.cueId === currentCue?.cueId) return { changed: false, cueId: currentCue?.cueId ?? null };
      currentCue = cue;
      if (!unlocked) return { changed: true, cueId: cue.cueId, deferred: true };
      const next = createAudio(cue);
      const previous = currentAudio;
      currentAudio = next;
      next.play().catch(() => {});
      transitionToken += 1;
      fade(previous, next, transitionToken);
      return { changed: true, cueId: cue.cueId };
    },
    pause() { currentAudio?.pause?.(); },
    async resume() { if (!unlocked || !currentAudio) return false; try { await currentAudio.play(); return true; } catch { return false; } },
    setVolume(value) { settings.volume = Math.min(1, Math.max(0, Number(value) || 0)); persist(); setAudioVolume(currentAudio, effectiveVolume()); },
    setMuted(value) { settings.muted = Boolean(value); persist(); setAudioVolume(currentAudio, effectiveVolume()); },
    getState() { return { cueId: currentCue?.cueId ?? null, unlocked, volume: settings.volume, muted: settings.muted, activeInstances: currentAudio ? 1 : 0 }; }
  };
}
