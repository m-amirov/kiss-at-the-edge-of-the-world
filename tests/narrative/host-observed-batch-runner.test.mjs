import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
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


const digest = (data) => crypto.createHash('sha256').update(data).digest('hex');
function physicalBatchFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'host-observed-batch-'));
  const files = captures().map((capture) => {
    const width = capture.viewport.width;
    const height = capture.viewport.height;
    const data = Buffer.alloc(24);
    Buffer.from([137,80,78,71,13,10,26,10]).copy(data);
    data.writeUInt32BE(13, 8);
    data.write('IHDR', 12);
    data.writeUInt32BE(width, 16);
    data.writeUInt32BE(height, 20);
    const filepath = path.join(root, capture.screenshot);
    fs.mkdirSync(path.dirname(filepath), {recursive: true});
    fs.writeFileSync(filepath, data);
    return {...capture, screenshotSha256: digest(data), screenshotBytes: data.length};
  });
  const plan = buildTurnPlan({
    sourceHead: '1'.repeat(40),
    captureSourceHead: '2'.repeat(40),
    scenes,
    captures: files
  });
  const reviews = plan.turns.map((turn, i) => {
    const text = 'The visible scenes and typography are consistently readable on all screenshots: '+turn.turnId;
    return {
      turnId: turn.turnId,
      role: turn.role,
      phase: 'acceptance',
      sourceHead: plan.sourceHead,
      status: 'PASS',
      semanticVerdict: 'PASS',
      actualPixelsReceived: true,
      findings: [],
      unresolved: [],
      decision: 'All supplied scene screenshots are compositionally sound and readable.',
      responseText: text,
      reviewedItems: [...new Set(turn.attachments.map(a => a.sceneId+':'+a.cue))],
      evidenceRefs: turn.attachments.map(a => a.ref),
      receivedEvidenceRefs: turn.attachments.map(a => a.ref),
      visualEvidence: turn.attachments.map(a => ({
        ref:a.ref,sceneId:a.sceneId,cue:a.cue,viewport:a.viewport,path:a.path,
        sha256:a.sha256,bytes:a.bytes,verdict:'PASS',
        observation:'The camera composition and dialogue panels are legible in '+a.sceneId+' at '+a.viewport
      })),
      hostObservedReceipt: {
        schema:'codex.web.host-observed.receipt.v1',policy:'HOST_OBSERVED_ART_ACCEPTANCE_V1',
        role:turn.role,sourceHead:plan.sourceHead,
        providerAttested:false,providerTaskId:null,providerResponseId:null,reviewTraceId:null,
        route:{model:'chatgpt-web/gpt-6-sol',selectedModel:'chatgpt-web/gpt-6-sol',reasoningEffort:'high',providerAttested:false},
        browser:{traceId:'trace-'+i,userTurnIdentity:'user-'+i,assistantTurnIdentity:'assistant-'+i,submission:'accepted',completion:'final',submissionEvidence:'user_turn'},
        response:{status:'completed',textSha256:digest(text)},
        attachments:turn.attachments.map(a=>({...a,mime:'image/png'}))
      }
    };
  });
  return {root,plan,reviews};
}
const run = f => verifyDeliveredReviews({plan:f.plan,reviews:f.reviews,projectRoot:f.root});
test('real batch format validates all six browser turns, 45 frame-role observations and actual PNG bytes',()=>{
  const f = physicalBatchFixture();
  assert.deepEqual(
    {status:run(f).status,turns:run(f).turns,imageReviews:run(f).imageReviews},
    {status:'PASS',turns:6,imageReviews:45}
  );
});
const negativeCases = [
  ['missing selected model',f=>{delete f.reviews[0].hostObservedReceipt.route.selectedModel},'WEB_HIGH_BATCH_DELIVERY_INCOMPLETE'],
  ['wrong model',f=>{f.reviews[0].hostObservedReceipt.route.model='gpt-5.6-sol'},'WEB_HIGH_BATCH_DELIVERY_INCOMPLETE'],
  ['spoofed provider evidence',f=>{f.reviews[0].hostObservedReceipt.providerAttested=true},'WEB_HIGH_BATCH_DELIVERY_INCOMPLETE'],
  ['missing submission acknowledgement',f=>{
    f.reviews[0].hostObservedReceipt.browser.userTurnIdentity=null;
    f.reviews[0].hostObservedReceipt.browser.submissionEvidence=null;
  },'WEB_HIGH_BATCH_DELIVERY_INCOMPLETE'],
  ['duplicate assistant turn',f=>{
    f.reviews[1].hostObservedReceipt.browser.assistantTurnIdentity=f.reviews[0].hostObservedReceipt.browser.assistantTurnIdentity;
  },'WEB_HIGH_BATCH_BROWSER_DUPLICATE'],
  ['duplicate browser trace',f=>{
    f.reviews[1].hostObservedReceipt.browser.traceId=f.reviews[0].hostObservedReceipt.browser.traceId;
  },'WEB_HIGH_BATCH_BROWSER_DUPLICATE'],
  ['modified response',f=>{f.reviews[0].responseText+=' modified'},'WEB_HIGH_BATCH_DELIVERY_INCOMPLETE'],
  ['missing visual evidence',f=>{f.reviews[0].visualEvidence.pop()},'WEB_HIGH_BATCH_DELIVERY_INCOMPLETE'],
  ['REWORK verdict',f=>{f.reviews[0].visualEvidence[0].verdict='REWORK'},'WEB_HIGH_BATCH_DELIVERY_INCOMPLETE'],
  ['wrong viewport observation',f=>{f.reviews[0].visualEvidence[0].viewport='portrait360'},'WEB_HIGH_BATCH_DELIVERY_INCOMPLETE'],
  ['physical PNG changed',f=>{
    fs.writeFileSync(path.join(f.root,f.plan.turns[0].attachments[0].path),'altered');
  },'WEB_HIGH_BATCH_LOCAL_BYTES_MISMATCH'],
];
for (const [name, change, expected] of negativeCases) {
  test('batch verification blocks '+name,()=>{
    const f=physicalBatchFixture();
    change(f);
    const result=run(f);
    assert.equal(result.code, expected, JSON.stringify(result));
  });
}
test('batch verification rejects absent local worktree',()=>{
  const f=physicalBatchFixture();
  assert.equal(verifyDeliveredReviews({plan:f.plan,reviews:f.reviews}).code,'WEB_HIGH_BATCH_LOCAL_BYTES_UNVERIFIED');
});
