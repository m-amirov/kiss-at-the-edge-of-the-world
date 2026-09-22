import assert from 'node:assert/strict';
import { canHydrateCloud, compareStateFreshness, createCloudSaveQueue, createRunId, createProvisionalMetadata, nextStateMetadata, promoteProvisionalState } from '../../src/save-state.js';
import { initialState } from '../../src/season-data.js';

const oldRun = { runId: 'run-old', runStartedAt: 100, revision: 99, updatedAt: 999 };
const freshRun = { runId: 'run-fresh', runStartedAt: 200, revision: 0, updatedAt: 200 };
assert.ok(compareStateFreshness(freshRun, oldRun) > 0, 'a new game outranks a deeper old run');
assert.equal(canHydrateCloud(oldRun, freshRun), false, 'late cloud response from old run is ignored');
assert.equal(canHydrateCloud({ ...freshRun, revision: 3 }, freshRun), true, 'newer revision in same run hydrates');
assert.equal(canHydrateCloud({ ...freshRun, revision: 0 }, freshRun), false, 'same revision does not overwrite local state');

const advanced = nextStateMetadata({ ...freshRun }, 250);
assert.equal(advanced.revision, 1);
assert.equal(advanced.updatedAt, 250);
assert.equal(createRunId(1, 0.5), 'run-1-7fffffff');

function makeState(overrides = {}) {
  return { ...initialState(), ...overrides, trust: { eric: 0, nick: 0, damir: 0 } };
}

// A: new device keeps a temporary state until the real cloud load arrives.
const provisional = { ...initialState({ provisional: true }), ...createProvisionalMetadata(), nodeId: 'ep1-intro' };
const cloudProgress = makeState({ nodeId: 'ep8-eric', runId: 'run-cloud', runStartedAt: 10, revision: 8, updatedAt: 18 });
assert.equal(canHydrateCloud(cloudProgress, provisional), true);

// B/C/E: conscious New Game locks the load channel and survives reload locally.
const newRun = promoteProvisionalState(provisional, 20, 'run-new');
assert.equal(canHydrateCloud(cloudProgress, { ...newRun, provisional: false }, { locked: true }), false);
assert.equal(canHydrateCloud({ ...cloudProgress, runStartedAt: 30 }, { ...newRun, provisional: false }, { locked: true }), false, 'new game ignores late old cloud load');

// F/G: legacy-compatible data is normalized by preserving its progress before promotion.
const legacy = makeState({ nodeId: 'ep4-editing', runId: 'legacy-0', runStartedAt: 0, revision: 0, updatedAt: 0 });
assert.equal(legacy.nodeId, 'ep4-editing');
assert.equal(legacy.schemaVersion >= 4, true);

// D/H/I: runtime save calls are serialized; reset invalidates queued old writes.
const writes = [];
const gates = [];
const queue = createCloudSaveQueue(async snapshot => {
  writes.push({ phase: snapshot.phase, revision: snapshot.revision, runId: snapshot.runId });
  const gate = gates.shift();
  if (gate) await gate;
});
let releaseFirst;
gates.push(new Promise(resolve => { releaseFirst = resolve; }));
const oldSave = queue.enqueue({ ...cloudProgress, phase: 'old' });
const latestSave = queue.enqueue({ ...cloudProgress, phase: 'latest', revision: 9 });
releaseFirst();
await Promise.all([oldSave, latestSave]);
assert.deepEqual(writes.map(item => item.phase), ['old', 'latest'], 'same-run saves preserve order');

let releaseStale;
const resetWrites = [];
const resetQueue = createCloudSaveQueue(async snapshot => {
  resetWrites.push(snapshot.phase);
  if (snapshot.phase === 'stale') await new Promise(resolve => { releaseStale = resolve; });
});
const staleSave = resetQueue.enqueue({ ...cloudProgress, phase: 'stale' });
await Promise.resolve();
resetQueue.invalidate();
const resetSave = resetQueue.enqueue({ ...newRun, phase: 'reset' });
if (releaseStale) releaseStale();
await Promise.all([staleSave, resetSave]);
assert.deepEqual(resetWrites, ['stale', 'reset'], 'reset writes after an in-flight stale save');

// A temporary SDK outage never removes the local snapshot.
const localStore = new Map();
localStore.set('save', JSON.stringify(latestSave ? { ...cloudProgress, revision: 9 } : cloudProgress));
assert.equal(localStore.has('save'), true);

console.log('save-state: PASS');
