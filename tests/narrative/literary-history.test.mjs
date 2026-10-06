import test from 'node:test';
import assert from 'node:assert/strict';
import { createDialogueHistory } from '../../src/literary-history.js';

const initial = () => ({
  schemaVersion: 3,
  sceneId: 'S02',
  position: 0,
  choices: {},
  visited: ['S02'],
  finished: false,
  revision: 0,
  runId: 'test-run'
});

test('dialogue history restores complete prior reader state across two steps', () => {
  const history = createDialogueHistory();
  const state = initial();
  const first = structuredClone(state);
  history.record(state);
  state.position = 1;
  state.visited.push('S03');
  const second = structuredClone(state);
  history.record(state);
  state.sceneId = 'S03';
  state.position = 0;
  state.choices['S02-C1'] = 'A';

  assert.deepEqual(history.rollback(state), second);
  assert.deepEqual(history.rollback(state), first);
  assert.equal(history.rollback(state), null);
});

test('choice rollback removes its result without replaying an effect', () => {
  const history = createDialogueHistory();
  const state = initial();
  state.position = 24;
  history.record(state);
  state.choices['S02-C91'] = 'B';
  state.position = 25;

  const restored = history.rollback(state);
  assert.deepEqual(restored.choices, {});
  assert.equal(restored.position, 24);
  assert.equal(history.canRollback(), false);
});

test('history snapshots are immutable copies of narrative variables', () => {
  const history = createDialogueHistory();
  const state = initial();
  state.choices['S01-C1'] = 'A';
  history.record(state);
  state.choices['S01-C1'] = 'B';

  assert.equal(history.rollback(state).choices['S01-C1'], 'A');
});
