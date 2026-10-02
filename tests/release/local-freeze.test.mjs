import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyLocalFreeze } from '../../tools/release/local-freeze.mjs';
const blocker = code => ({ code, reason: code });

test('local freeze passes only when external Yandex evidence is the sole preflight blocker', () => {
  const result = verifyLocalFreeze({ status: 'BLOCKED', blockers: [blocker('EXTERNAL_YANDEX_EVIDENCE')] });
  assert.equal(result.status, 'PASS_FINAL_LOCAL_RC_FREEZE'); assert.equal(result.nextBlocker, 'EXTERNAL_YANDEX_EVIDENCE');
});
for (const blockers of [[], [blocker('FINAL_QA_MISSING')], [blocker('EXTERNAL_YANDEX_EVIDENCE'), blocker('FINAL_QA_MISSING')]]) {
  test(`local freeze blocks for ${blockers.map(x => x.code).join(',') || 'no blocker'}`, () => assert.equal(verifyLocalFreeze({ status: blockers.length ? 'BLOCKED' : 'PASS', blockers }).status, 'BLOCKED_FINAL_LOCAL_RC_FREEZE'));
}
