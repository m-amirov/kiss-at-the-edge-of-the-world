import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTurnPlan, verifyDeliveredReviews, MAX_ATTACHMENTS, ROLES } from '../../tools/release/host-observed-batch-runner.mjs';

const scenes = ['S03', 'S18', 'S42', 'S44', 'S46'];
const viewports = [
  ['desktop', 1920, 900],
  ['portrait390', 390, 844],
  ['portrait360', 360, 640],
];

function captures() {
  return scenes.flatMap((sceneId) => viewports.map(([name, width, height], index) => ({
    sceneId,
    cue: `${sceneId.toLowerCase()}-cue`,
    currentHead: '2'.repeat(40),
    viewport: { name, width, height },
    screenshot: `artifacts/${sceneId}-${name}.png`,
    screenshotSha256: `${String(index + 1).repeat(64).slice(0, 64)}`,
    screenshotBytes: 100 + index,
  })));
}

test('plans five scenes into three-role turns with no more than ten attachments', () => {
  const plan = buildTurnPlan({
    sourceHead: '1'.repeat(40),
    captureSourceHead: '2'.repeat(40),
    scenes,
    captures: captures(),
  });

  assert.equal(plan.turns.length, ROLES.length * 2);
  assert.ok(plan.turns.every((turn) => turn.attachments.length <= MAX_ATTACHMENTS));
  assert.ok(plan.turns.every((turn) => new Set(turn.attachments.map((item) => item.ref)).size === turn.attachments.length));
  assert.deepEqual(plan.turns.filter((turn) => turn.role === ROLES[0]).map((turn) => turn.sceneIds), [
    ['S03', 'S18', 'S42'],
    ['S44', 'S46'],
  ]);
  assert.equal(plan.status, 'PENDING_WEB_HIGH');
});

test('blocks incomplete delivery and never promotes pending turns', () => {
  const plan = buildTurnPlan({
    sourceHead: '1'.repeat(40),
    captureSourceHead: '2'.repeat(40),
    scenes,
    captures: captures(),
  });

  const result = verifyDeliveredReviews({
    plan,
    reviews: plan.turns.slice(0, 1).map((turn) => ({
      turnId: turn.turnId,
      role: turn.role,
      sourceHead: plan.sourceHead,
      status: 'PASS',
      actualPixelsReceived: true,
      hostObservedReceipt: { attachments: turn.attachments },
    })),
  });

  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.code, 'WEB_HIGH_BATCH_DELIVERY_INCOMPLETE');
});
