import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROLES = ['ceos_reasoner_web', 'ceos_bulk_checker_web', 'ceos_art_director_web'];
export const MAX_ATTACHMENTS = 10;
export const MAX_TURN_BYTES = 50_000_000;
const POLICY = 'HOST_OBSERVED_ART_ACCEPTANCE_V1';
const RECEIPT_SCHEMA = 'codex.web.host-observed.receipt.v1';
export const VIEWPORTS = {
  desktop: [1920, 900],
  portrait390: [390, 844],
  portrait360: [360, 640],
};
const MODEL = 'chatgpt-web/gpt-6-sol';

const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const blocked = (code, reason, extra = {}) => ({ status: 'BLOCKED', code, reason, ...extra });
const isHash = (value) => typeof value === 'string' && /^[a-f0-9]{40}$/i.test(value);
const isSha256 = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
const isText = (value) => typeof value === 'string' && value.trim().length > 0;

function normalizeViewport(viewport) {
  if (typeof viewport === 'string') {
    const match = Object.entries(VIEWPORTS).find(([name]) => name === viewport);
    return match ? { name: match[0], width: match[1][0], height: match[1][1] } : null;
  }
  return viewport && VIEWPORTS[viewport.name] ? viewport : null;
}

function sceneChunks(sceneIds) {
  const scenesPerTurn = Math.floor(MAX_ATTACHMENTS / Object.keys(VIEWPORTS).length);
  const chunks = [];
  for (let index = 0; index < sceneIds.length; index += scenesPerTurn) {
    chunks.push(sceneIds.slice(index, index + scenesPerTurn));
  }
  return chunks;
}

export function buildTurnPlan({ sourceHead, captureSourceHead, scenes, captures }) {
  if (!isHash(sourceHead) || !isHash(captureSourceHead)) {
    throw new Error('sourceHead and captureSourceHead must be full SHA-256-like Git hashes');
  }
  if (!Array.isArray(scenes) || scenes.length !== 5 || new Set(scenes).size !== scenes.length) {
    throw new Error('first batch must contain exactly five unique scenes');
  }
  if (!Array.isArray(captures)) throw new Error('captures must be an array');

  const byKey = new Map();
  for (const capture of captures) {
    const viewport = normalizeViewport(capture.viewport);
    const key = `${capture.sceneId}:${viewport?.name ?? '?'}`;
    if (!scenes.includes(capture.sceneId) || !viewport || byKey.has(key)) continue;
    byKey.set(key, { ...capture, viewport });
  }

  const selected = [];
  for (const sceneId of scenes) {
    for (const viewportName of Object.keys(VIEWPORTS)) {
      const capture = byKey.get(`${sceneId}:${viewportName}`);
      if (!capture) throw new Error(`missing capture ${sceneId}/${viewportName}`);
      if (capture.currentHead !== captureSourceHead) {
        throw new Error(`capture source mismatch ${sceneId}/${viewportName}`);
      }
      selected.push(capture);
    }
  }

  const turns = [];
  for (const role of ROLES) {
    for (const [chunkIndex, sceneIds] of sceneChunks(scenes).entries()) {
      let attachmentIndex = 0;
      const attachments = sceneIds.flatMap((sceneId) => selected
        .filter((capture) => capture.sceneId === sceneId)
        .map((capture) => ({
          ref: `codex-input-image-${++attachmentIndex}`,
          sceneId: capture.sceneId,
          cue: capture.cue,
          viewport: capture.viewport.name,
          path: capture.screenshot,
          sha256: capture.screenshotSha256,
          bytes: capture.screenshotBytes,
          dimensions: [capture.viewport.width, capture.viewport.height],
        })));
      if (attachments.length > MAX_ATTACHMENTS) {
        throw new Error(`turn ${role}/${chunkIndex + 1} exceeds ${MAX_ATTACHMENTS} attachments`);
      }
      turns.push({
        turnId: `batch1-${role}-${chunkIndex + 1}`,
        role,
        sceneIds,
        attachments,
        maxAttachments: MAX_ATTACHMENTS,
        delivery: 'PENDING',
        verdict: 'NOT_RUN',
      });
    }
  }

  return {
    schemaVersion: 1,
    recordType: 'host-observed-web-high-batch-plan',
    batchId: 'BATCH1-S03-S18-S42-S44-S46-2026-10-09',
    status: 'PENDING_WEB_HIGH',
    verdict: 'NOT_RUN',
    sourceHead,
    captureSourceHead,
    sceneIds: [...scenes],
    viewports: Object.entries(VIEWPORTS).map(([name, [width, height]]) => ({ name, width, height })),
    roles: [...ROLES],
    deliveryContract: {
      model: MODEL,
      reasoningEffort: 'high',
      maxAttachmentsPerBrowserTurn: MAX_ATTACHMENTS,
      maxBytesPerBrowserTurn: MAX_TURN_BYTES,
      requiredTurns: turns.length,
      incompleteDelivery: 'BLOCKED',
      historicalReviews: 'NOT_USED_AS_PASS',
    },
    turns,
  };
}

function sameAttachment(expected, actual) {
  return actual?.ref === expected.ref && actual.sceneId === expected.sceneId &&
    actual.cue === expected.cue && actual.viewport === expected.viewport &&
    actual.path === expected.path && actual.sha256 === expected.sha256 &&
    actual.bytes === expected.bytes &&
    Array.isArray(actual.dimensions) && actual.dimensions[0] === expected.dimensions[0] &&
    actual.dimensions[1] === expected.dimensions[1];
}

export function verifyDeliveredReviews({ plan, reviews, projectRoot }) {
  if (!plan || plan.status !== 'PENDING_WEB_HIGH' || plan.verdict !== 'NOT_RUN') {
    return blocked('WEB_HIGH_BATCH_PLAN_INVALID', 'Only a pending batch plan can be verified.');
  }
  if (!Array.isArray(reviews) || reviews.length !== plan.turns.length) {
    return blocked('WEB_HIGH_BATCH_DELIVERY_INCOMPLETE', `Expected ${plan.turns.length} complete role-turn receipts.`);
  }

  const seenTurns = new Set();
  const seenTraces = new Set();
  const seenAssistants = new Set();
  if (!projectRoot || !fs.existsSync(projectRoot))
    return blocked('WEB_HIGH_BATCH_LOCAL_BYTES_UNVERIFIED', 'Physical PNG bytes must be rechecked from the actual project worktree.');
  for (const turn of plan.turns) {
    const review = reviews.find((item) => item?.turnId === turn.turnId);
    if (!review || seenTurns.has(turn.turnId)) {
      return blocked('WEB_HIGH_BATCH_DELIVERY_INCOMPLETE', `Missing or duplicated receipt for ${turn.turnId}.`);
    }
    seenTurns.add(turn.turnId);
    const receipt = review.hostObservedReceipt;
    const route = receipt?.route;
    const attachments = receipt?.attachments;
    const evidenceRefs = review.evidenceRefs;
    const receivedRefs = review.receivedEvidenceRefs;
    const browser = receipt?.browser;
    const reply = receipt?.response;
    const responseSha256 = isText(review.responseText) ? sha256(review.responseText) : null;
    if (review.role !== turn.role || review.sourceHead !== plan.sourceHead ||
        review.phase !== 'acceptance' || review.status !== 'PASS' ||
        review.semanticVerdict !== 'PASS' || review.actualPixelsReceived !== true ||
        !Array.isArray(review.findings) || review.findings.length > 0 ||
        !Array.isArray(review.unresolved) || review.unresolved.length > 0 ||
        !isText(review.decision) || review.decision.trim().length < 25 ||
        !isText(review.responseText) || !isSha256(responseSha256) ||
        !Array.isArray(review.reviewedItems) ||
        !Array.isArray(review.visualEvidence) || review.visualEvidence.length !== turn.attachments.length ||
        receipt?.schema !== RECEIPT_SCHEMA || receipt?.policy !== POLICY ||
        receipt?.role !== turn.role || receipt?.sourceHead !== plan.sourceHead ||
        route?.model !== MODEL || route?.selectedModel !== MODEL ||
        route?.reasoningEffort !== 'high' || route?.providerAttested !== false ||
        receipt?.providerAttested !== false || receipt?.providerTaskId !== null ||
        receipt?.providerResponseId !== null || receipt?.reviewTraceId !== null ||
        !isText(browser?.traceId) || !isText(browser?.assistantTurnIdentity) ||
        !(isText(browser?.userTurnIdentity) ||
          (browser?.userTurnIdentity == null && browser?.submissionEvidence === 'user_turn')) ||
        browser?.submission !== 'accepted' || browser?.completion !== 'final' ||
        reply?.status !== 'completed' || reply?.textSha256 !== responseSha256 ||
        !Array.isArray(attachments) || attachments.length !== turn.attachments.length ||
        attachments.length > MAX_ATTACHMENTS || !Array.isArray(evidenceRefs) ||
        !Array.isArray(receivedRefs) || evidenceRefs.length !== attachments.length ||
        receivedRefs.length !== attachments.length ||
        new Set(evidenceRefs).size !== evidenceRefs.length ||
        new Set(receivedRefs).size !== receivedRefs.length ||
        !evidenceRefs.every((ref) => receivedRefs.includes(ref))) {
      return blocked('WEB_HIGH_BATCH_DELIVERY_INCOMPLETE', `Incomplete or invalid delivery receipt for ${turn.turnId}.`);
    }
    if (seenTraces.has(browser.traceId) || seenAssistants.has(browser.assistantTurnIdentity)) {
      return blocked('WEB_HIGH_BATCH_BROWSER_DUPLICATE', 'Browser trace or assistant turn was reused: ' + turn.turnId);
    }
    seenTraces.add(browser.traceId);
    seenAssistants.add(browser.assistantTurnIdentity);
    const totalBytes = attachments.reduce((sum, attachment) => sum + (attachment.bytes ?? 0), 0);
    if (totalBytes > MAX_TURN_BYTES) {
      return blocked('WEB_HIGH_BATCH_ATTACHMENT_LIMIT', `${turn.turnId} exceeds ${MAX_TURN_BYTES} bytes.`);
    }
    const seenFrames = new Set();
    const attachmentRefs = new Set(attachments.map((item) => item?.ref));
    if (attachmentRefs.size !== turn.attachments.length ||
        new Set(review.visualEvidence.map((item) => item?.ref)).size !== turn.attachments.length) {
      return blocked('WEB_HIGH_BATCH_DELIVERY_INCOMPLETE', 'Duplicated frame evidence: ' + turn.turnId);
    }
    for (const expected of turn.attachments) {
      const actual = attachments.find((item) => item.ref === expected.ref);
      const visual = review.visualEvidence.find((item) => item?.ref === expected.ref);
      if (!sameAttachment(expected, actual) || !visual ||
          visual.sceneId !== expected.sceneId || visual.cue !== expected.cue ||
          visual.viewport !== expected.viewport || visual.path !== expected.path ||
          visual.sha256 !== expected.sha256 || visual.bytes !== expected.bytes ||
          !isText(visual.observation) || visual.observation.trim().length < 30 ||
          visual.verdict !== 'PASS' || seenFrames.has(expected.ref) ||
          !review.reviewedItems.includes(expected.sceneId + ':' + expected.cue) ||
          !evidenceRefs.includes(expected.ref) || !receivedRefs.includes(expected.ref) ||
          actual.mime !== 'image/png') {
        return blocked('WEB_HIGH_BATCH_DELIVERY_INCOMPLETE', `Attachment/reviewer observation mismatch for ${turn.turnId}/${expected.ref}.`);
      }
      seenFrames.add(expected.ref);
      const relative = path.relative(projectRoot, path.resolve(projectRoot, expected.path));
      if (path.isAbsolute(expected.path) || relative === '..' ||
          relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
        return blocked('WEB_HIGH_BATCH_LOCAL_BYTES_UNVERIFIED', 'PNG escapes project root: ' + expected.path);
      }
      const full = path.resolve(projectRoot, expected.path);
      const realRoot = fs.realpathSync(projectRoot);
      const realFile = fs.existsSync(full) ? fs.realpathSync(full) : '';
      const realRelative = realFile ? path.relative(realRoot, realFile) : '..';
      if (!realFile || realRelative === '..' ||
          realRelative.startsWith('..' + path.sep) || path.isAbsolute(realRelative)) {
        return blocked('WEB_HIGH_BATCH_LOCAL_BYTES_UNVERIFIED', 'PNG file missing or outside project root: ' + expected.path);
      }
      const png = pngInfo(full);
      if (!png || png.sha256 !== expected.sha256 || png.bytes !== expected.bytes ||
          png.width !== expected.dimensions[0] || png.height !== expected.dimensions[1]) {
        return blocked('WEB_HIGH_BATCH_LOCAL_BYTES_MISMATCH', 'Physical PNG differs from reviewed attachment: ' + expected.path);
      }
    }
  }
  return {
    status: 'PASS',
    verdict: 'PASS_HOST_OBSERVED_BATCH_ONLY',
    turns: plan.turns.length,
    imageReviews: plan.turns.reduce((sum, turn) => sum + turn.attachments.length, 0),
    roles: plan.roles.length,
    scenes: plan.sceneIds.length,
    fullSeasonAcceptance: 'NOT_IN_SCOPE',
  };
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function proveRuntimeLineage(root, captureSourceHead, sourceHead) {
  try {
    git(root, ['merge-base', '--is-ancestor', captureSourceHead, sourceHead]);
  } catch {
    return blocked('WEB_HIGH_RUNTIME_LINEAGE_UNPROVEN', 'Capture source is not an ancestor of the target runtime source.');
  }
  const changedFiles = git(root, ['diff', '--name-only', `${captureSourceHead}..${sourceHead}`]).split(/\r?\n/).filter(Boolean);
  const runtimeFiles = changedFiles.filter((file) => /^(src\/|assets\/|content\/|index\.html$|game-spec\.yaml$)/.test(file));
  if (runtimeFiles.length) {
    return blocked('WEB_HIGH_RUNTIME_SOURCE_CHANGED', 'Runtime files changed after capture source.', { changedFiles, runtimeFiles });
  }
  return { status: 'PASS', changedFiles, runtimeFiles: [] };
}

function pngInfo(file) {
  const bytes = fs.readFileSync(file);
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
      bytes.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { bytes: bytes.length, sha256: sha256(bytes), width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function prepare(root) {
  const matrixPath = argument('--matrix');
  const outputPath = argument('--output') ?? 'artifacts/production-art/WEB_HIGH_BATCH_1_2026-10-09.json';
  const scenes = (argument('--scenes') ?? '').split(',').map((item) => item.trim()).filter(Boolean);
  const sourceHead = argument('--source-head') ?? git(root, ['rev-parse', 'HEAD']);
  if (!matrixPath || scenes.length !== 5) throw new Error('--matrix and exactly five comma-separated --scenes are required');
  const matrix = JSON.parse(fs.readFileSync(path.resolve(root, matrixPath), 'utf8'));
  if (matrix.status !== 'PASS' || matrix.sourceHead == null || !Array.isArray(matrix.scenes)) {
    throw new Error('matrix must be a PASS runtime matrix with a sourceHead');
  }
  const lineage = proveRuntimeLineage(root, matrix.sourceHead, sourceHead);
  if (lineage.status !== 'PASS') throw new Error(`${lineage.code}: ${lineage.reason}`);
  const captures = scenes.flatMap((sceneId) => matrix.scenes.find((scene) => scene.sceneId === sceneId)?.captures ?? []);
  const plan = buildTurnPlan({ sourceHead, captureSourceHead: matrix.sourceHead, scenes, captures });
  for (const attachment of plan.turns.flatMap((turn) => turn.attachments)) {
    const file = path.resolve(root, attachment.path);
    const actual = fs.existsSync(file) ? pngInfo(file) : null;
    const [width, height] = attachment.dimensions;
    if (!actual || actual.sha256 !== attachment.sha256 || actual.bytes !== attachment.bytes ||
        actual.width !== width || actual.height !== height) {
      throw new Error(`current PNG mismatch: ${attachment.path}`);
    }
  }
  plan.runtimeLineage = lineage;
  plan.runtimePngs = plan.turns.flatMap((turn) => turn.attachments).map((attachment) => ({
    path: attachment.path,
    sha256: attachment.sha256,
    bytes: attachment.bytes,
    dimensions: attachment.dimensions,
  }));
  const output = path.resolve(root, outputPath);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(plan, null, 2)}\n`);
  console.log(JSON.stringify({ status: plan.status, output: outputPath, scenes, roles: plan.roles.length, turns: plan.turns.length, imageReviews: plan.runtimePngs.length, maxAttachmentsPerTurn: MAX_ATTACHMENTS }, null, 2));
}

function verify(root) {
  const planPath = argument('--plan');
  const paths = (argument('--web-reviews') ?? '').split(';').map((item) => item.trim()).filter(Boolean);
  if (!planPath || !paths.length) throw new Error('--plan and --web-reviews <file;file;...> are required');
  const plan = JSON.parse(fs.readFileSync(path.resolve(root, planPath), 'utf8'));
  const reviews = paths.map((file) => JSON.parse(fs.readFileSync(path.resolve(root, file), 'utf8')));
  const lineage = proveRuntimeLineage(root, plan.captureSourceHead, plan.sourceHead);
  if (lineage.status !== 'PASS') {
    console.log(JSON.stringify(lineage, null, 2));
    process.exitCode = 2;
    return;
  }
  const current = git(root, ['rev-parse', 'HEAD']);
  const currentLineage = proveRuntimeLineage(root, plan.sourceHead, current);
  if (currentLineage.status !== 'PASS') {
    console.log(JSON.stringify(currentLineage, null, 2));
    process.exitCode = 2;
    return;
  }
  const result = verifyDeliveredReviews({ plan, reviews, projectRoot: root });
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'PASS') process.exitCode = 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  try {
    if (process.argv.includes('--verify')) verify(process.cwd());
    else prepare(process.cwd());
  } catch (error) {
    console.error(`WEB_HIGH_BATCH_BLOCKED: ${error.message}`);
    process.exitCode = 2;
  }
}
