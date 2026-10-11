export function episodeBoundaryFor(fromSceneId, toSceneId, byId) {
  const from = byId?.get(fromSceneId);
  const to = byId?.get(toSceneId);
  if (!from || !to || to.episode !== from.episode + 1) return null;
  return {
    fromSceneId: from.id,
    toSceneId: to.id,
    fromEpisode: from.episode,
    toEpisode: to.episode
  };
}

export function normalizePendingEpisodeTransition(value, byId) {
  if (!value || typeof value !== 'object') return null;
  const boundary = episodeBoundaryFor(value.fromSceneId, value.toSceneId, byId);
  if (!boundary) return null;
  if (value.fromEpisode !== boundary.fromEpisode || value.toEpisode !== boundary.toEpisode) return null;
  return boundary;
}

export function completePendingEpisodeTransition(state, byId) {
  const pending = normalizePendingEpisodeTransition(state?.pendingEpisodeTransition, byId);
  if (!pending) {
    if (state?.pendingEpisodeTransition == null) return { state, changed: false };
    return { state: { ...state, pendingEpisodeTransition: null }, changed: true };
  }
  if (state.sceneId !== pending.fromSceneId && state.sceneId !== pending.toSceneId) {
    return { state: { ...state, pendingEpisodeTransition: null }, changed: true };
  }
  if (state.sceneId === pending.toSceneId) {
    return { state: { ...state, pendingEpisodeTransition: null }, changed: true };
  }
  const visited = Array.isArray(state.visited) ? [...state.visited] : [];
  if (!visited.includes(pending.toSceneId)) visited.push(pending.toSceneId);
  return {
    state: {
      ...state,
      sceneId: pending.toSceneId,
      position: 0,
      finished: false,
      visited,
      pendingEpisodeTransition: null
    },
    changed: true
  };
}

export function createEpisodeTransitionController({ getState, setState, byId, persist, render, showFullscreenAd }) {
  let inFlight = false;

  const finish = () => {
    if (!inFlight) return;
    inFlight = false;
    const completed = completePendingEpisodeTransition(getState(), byId);
    setState(completed.state);
    if (completed.changed) persist?.();
    render?.();
  };

  return {
    start(toSceneId) {
      if (inFlight) return false;
      const state = getState();
      if (state?.pendingEpisodeTransition) return false;
      const boundary = episodeBoundaryFor(state?.sceneId, toSceneId, byId);
      if (!boundary) return false;
      setState({ ...state, pendingEpisodeTransition: boundary });
      // The local snapshot is synchronous. Do not await cloud persistence
      // before entering the platform ad call: Yandex allows at most 2 seconds.
      persist?.();
      inFlight = true;
      let adResult;
      try {
        adResult = showFullscreenAd?.();
      } catch {
        adResult = false;
      }
      Promise.resolve(adResult).catch(() => false).then(finish);
      return true;
    },
    resumePending({ render: shouldRender = true } = {}) {
      if (inFlight) return false;
      const completed = completePendingEpisodeTransition(getState(), byId);
      if (!completed.changed) return false;
      setState(completed.state);
      persist?.();
      if (shouldRender) render?.();
      return true;
    },
    isInFlight() { return inFlight; }
  };
}
