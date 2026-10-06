import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const player = fs.readFileSync(new URL('../../src/literary-player.js', import.meta.url), 'utf8');
const runner = fs.readFileSync(new URL('../../tools/visual-qa/s22-s26-runtime.mjs', import.meta.url), 'utf8');

test('visual QA navigation is isolated from production URL and gameplay controls', () => {
  const playerWithoutBoundedInputDebug = player.replace(
    "const inputDebugEnabled=new URLSearchParams(window.location.search).has('inputDebug')||window.__LITERARY_INPUT_DEBUG__===true;",
    ''
  );
  assert.match(player, /const inputDebugEnabled=new URLSearchParams\(window\.location\.search\)\.has\('inputDebug'\)\|\|window\.__LITERARY_INPUT_DEBUG__===true;/);
  assert.doesNotMatch(playerWithoutBoundedInputDebug, /URLSearchParams|location\.search|location\.hash/);
  assert.match(player, /window\.__LITERARY_QA__/);
  assert.match(player, /getState:.*getFlow:.*getScenes:.*getScreen:/s);
  assert.doesNotMatch(runner, /page\.goto\([^)]*\?/);
  assert.match(runner, /localStorage\.setItem\(key, JSON\.stringify\(value\)\)/);
  assert.match(runner, /literarySaveKey/);
});
