export const SAVE_SCHEMA_VERSION = 4;

export function createRunId(now = Date.now(), random = Math.random()) {
  const suffix = Math.floor(random * 0xFFFFFFFF).toString(16).padStart(8, '0');
  return `run-${now.toString(36)}-${suffix}`;
}

export function createStateMetadata({ runId = createRunId(), runStartedAt = Date.now(), revision = 0, updatedAt = runStartedAt } = {}) {
  return { runId, runStartedAt, revision, updatedAt, schemaVersion: SAVE_SCHEMA_VERSION, provisional: false };
}

export function createProvisionalMetadata() {
  return { runId: null, runStartedAt: 0, revision: 0, updatedAt: 0, schemaVersion: SAVE_SCHEMA_VERSION, provisional: true };
}

export function promoteProvisionalState(state, now = Date.now(), runId = createRunId(now)) {
  return { ...state, ...createStateMetadata({ runId, runStartedAt: now, revision: 0, updatedAt: now }) };
}

export function nextStateMetadata(state, now = Date.now()) {
  return {
    ...createStateMetadata(state),
    revision: Number.isInteger(state.revision) ? state.revision + 1 : 1,
    updatedAt: now,
    schemaVersion: SAVE_SCHEMA_VERSION
  };
}

export function compareStateFreshness(candidate, current) {
  if (!candidate || !current) return candidate ? 1 : -1;
  if (candidate.runId !== current.runId) {
    return (candidate.runStartedAt || 0) - (current.runStartedAt || 0);
  }
  if ((candidate.revision || 0) !== (current.revision || 0)) {
    return (candidate.revision || 0) - (current.revision || 0);
  }
  return (candidate.updatedAt || 0) - (current.updatedAt || 0);
}

export function canHydrateCloud(candidate, current, { locked = false } = {}) {
  if (locked) return false;
  if (!candidate?.runId) return false;
  if (current?.provisional) return true;
  return Boolean(current?.runId) && compareStateFreshness(candidate, current) > 0;
}

export function createCloudSaveQueue(writeCloud) {
  let tail = Promise.resolve();
  let generation = 0;
  return {
    invalidate() { generation += 1; },
    enqueue(state) {
      const requestGeneration = generation;
      const snapshot = structuredClone(state);
      tail = tail.then(async () => {
        if (requestGeneration !== generation) return { skipped: true, reason: 'invalidated' };
        await writeCloud(snapshot);
        return { skipped: false };
      });
      return tail;
    }
  };
}
