export function createPlatformLifecycleController({
  app,
  document = globalThis.document,
  setGameplayActive = () => {},
  isGameplayActive = () => true,
  onPause = () => {},
  onResume = () => {}
} = {}) {
  const reasons = new Set();
  let paused = false;
  let pausedMedia = [];

  function markPaused() {
    if (paused) return;
    paused = true;
    app?.setAttribute?.('aria-busy', 'true');
    if (app?.dataset) app.dataset.platformPaused = 'true';
    pausedMedia = [...(document?.querySelectorAll?.('audio,video') ?? [])]
      .filter((media) => media && media.paused === false);
    for (const media of pausedMedia) media.pause?.();
    setGameplayActive(false);
    onPause();
  }

  function markResumed() {
    if (!paused || reasons.size) return;
    paused = false;
    if (app?.dataset) delete app.dataset.platformPaused;
    app?.removeAttribute?.('aria-busy');
    const shouldResumeMedia = Boolean(isGameplayActive());
    if (shouldResumeMedia) {
      for (const media of pausedMedia) Promise.resolve(media.play?.()).catch(() => {});
    }
    pausedMedia = [];
    setGameplayActive(shouldResumeMedia);
    onResume();
  }

  const controller = {
    pause(reason = 'platform') {
      reasons.add(reason);
      markPaused();
    },
    resume(reason = 'platform') {
      reasons.delete(reason);
      markResumed();
    },
    setDocumentHidden(hidden) {
      if (hidden) controller.pause('document');
      else controller.resume('document');
    },
    isPaused: () => paused,
    getState: () => ({ paused, reasons: [...reasons] })
  };
  return controller;
}
