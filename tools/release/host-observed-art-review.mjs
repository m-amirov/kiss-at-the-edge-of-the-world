/**
 * HOST_OBSERVED_ART_ACCEPTANCE_V1
 * Browser-observed review provenance. This does NOT attest server-side image delivery
 * or provider identity, and cannot be substituted for CEOS strict web receipts.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { verifyVisualContentMatrix, VISUAL_REVIEW_ROLES } from './visual-content-review.mjs';

export const HOST_OBSERVED_ART_POLICY = 'HOST_OBSERVED_ART_ACCEPTANCE_V1';
export const HOST_OBSERVED_ART_ASSURANCE = 'host-observed-art-v1';
const MODEL = 'chatgpt-web/gpt-6-sol';
const VIEWPORTS = { desktop: [1920, 900], portrait390: [390, 844], portrait360: [360, 640] };
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const isText = value => typeof value === 'string' && value.trim().length > 0;
const isHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
const block = (code, reason) => ({ status: 'BLOCKED', code, reason });

function localPng(root, relative) {
  if (!isText(relative) || path.isAbsolute(relative) || /^[a-z]:/i.test(relative)) return null;
  const candidate = path.resolve(root, relative);
  const back = path.relative(root, candidate);
  if (!back || back === '..' || back.startsWith('..' + path.sep) || path.isAbsolute(back)) return null;
  if (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) return null;
  const realRoot = fs.realpathSync(root);
  const realBack = path.relative(realRoot, fs.realpathSync(candidate));
  if (realBack === '..' || realBack.startsWith('..' + path.sep) || path.isAbsolute(realBack)) return null;
  return candidate;
}

function pngDimensions(file) {
  const data = fs.readFileSync(file);
  if (data.length < 24 || !data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ||
      data.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { bytes: data.length, sha256: sha256(data), width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

/**
 * One review entry is ONE actual host/browser turn containing at most 10 frames.
 * All roles must independently review every scene and every required viewport.
 * Missing/duplicate/mismatched turns, findings and unverifiable frames fail closed.
 */
export function verifyHostObservedArtReviews({ projectRoot, matrix, sourceHead, reviewEntries }) {
  const checked = verifyVisualContentMatrix({ projectRoot, matrix, sourceHead });
  if (checked.status !== 'PASS') return checked;
  if (!Array.isArray(reviewEntries) || reviewEntries.length < 3)
    return block('ART_ACCEPTANCE_HOST_REVIEW_MISSING', 'Host-observed reviews from all three roles are required.');
  const required = new Set();
  for (const role of VISUAL_REVIEW_ROLES)
    for (const scene of matrix.scenes)
      for (const capture of scene.captures) required.add(role + ':' + scene.sceneId + ':' + capture.viewport.name);
  const seen = new Set(), traces = new Set(), assistantTurns = new Set(), reviewFiles = new Set();
  for (const { reference, evidence } of reviewEntries) {
    const role = evidence?.role ?? evidence?.agent;
    const receipt = evidence?.hostObservedReceipt;
    const browser = receipt?.browser;
    const route = receipt?.route;
    if (!VISUAL_REVIEW_ROLES.includes(role) || reference?.role !== role ||
        !isText(reference?.path) || reviewFiles.has(reference.path) ||
        evidence?.sourceHead !== sourceHead || evidence?.phase !== 'acceptance' ||
        evidence?.status !== 'PASS' || evidence?.semanticVerdict !== 'PASS' ||
        evidence?.actualPixelsReceived !== true || !isText(evidence?.decision) ||
        evidence.decision.trim().length < 25 || !Array.isArray(evidence.findings) ||
        evidence.findings.length || !Array.isArray(evidence.unresolved) || evidence.unresolved.length ||
        !isText(evidence.responseText) || !Array.isArray(evidence.visualEvidence) ||
        !Array.isArray(evidence.reviewedItems) || !Array.isArray(evidence.evidenceRefs) ||
        !Array.isArray(evidence.receivedEvidenceRefs)) {
      return block('ART_ACCEPTANCE_HOST_REVIEW_INVALID', 'Missing independent clean PASS or review identity: ' + (reference?.path ?? '?'));
    }
    reviewFiles.add(reference.path);
    if (receipt?.schema !== 'codex.web.host-observed.receipt.v1' ||
        receipt.policy !== HOST_OBSERVED_ART_POLICY ||
        receipt.providerAttested !== false || receipt.providerTaskId !== null ||
        receipt.providerResponseId !== null || receipt.reviewTraceId !== null ||
        receipt.sourceHead !== sourceHead || receipt.role !== role ||
        route?.model !== MODEL || route?.reasoningEffort !== 'high' ||
        route?.providerAttested !== false ||
        !isText(browser?.traceId) || !isText(browser?.userTurnIdentity) ||
        !isText(browser?.assistantTurnIdentity) || browser?.submission !== 'accepted' ||
        browser?.completion !== 'final' || receipt.response?.status !== 'completed' ||
        !isHash(receipt.response.textSha256) ||
        receipt.response.textSha256 !== sha256(evidence.responseText)) {
      return block('ART_ACCEPTANCE_HOST_RECEIPT_INVALID', 'Missing, mismatched or falsely provider-attested browser receipt.');
    }
    if (traces.has(browser.traceId) || assistantTurns.has(browser.assistantTurnIdentity))
      return block('ART_ACCEPTANCE_HOST_RECEIPT_DUPLICATE', 'Browser trace or assistant response identity was reused.');
    traces.add(browser.traceId);
    assistantTurns.add(browser.assistantTurnIdentity);
    const attachments = receipt.attachments;
    if (!Array.isArray(attachments) || attachments.length < 1 || attachments.length > 10 ||
        evidence.evidenceRefs.length !== attachments.length ||
        evidence.receivedEvidenceRefs.length !== attachments.length ||
        evidence.visualEvidence.length !== attachments.length ||
        new Set(evidence.evidenceRefs).size !== attachments.length ||
        new Set(evidence.receivedEvidenceRefs).size !== attachments.length ||
        !evidence.evidenceRefs.every(ref => isText(ref) && evidence.receivedEvidenceRefs.includes(ref)) ||
        new Set(attachments.map(x => x?.ref)).size !== attachments.length ||
        new Set(evidence.visualEvidence.map(x => x?.ref)).size !== attachments.length) {
      return block('ART_ACCEPTANCE_HOST_ATTACHMENTS_INVALID', 'Missing/duplicate attachment or over 10 files in one turn.');
    }
    let totalBytes = 0;
    const observed = new Set();
    for (const attachment of attachments) {
      const frame = evidence.visualEvidence.find(f => f?.ref === attachment?.ref);
      if (!frame || !evidence.evidenceRefs.includes(attachment.ref) ||
          !isText(frame.sceneId) || !isText(frame.cue) ||
          !Object.hasOwn(VIEWPORTS, frame.viewport) ||
          !isText(frame.observation) || frame.observation.trim().length < 30 ||
          frame.verdict !== 'PASS' || !isText(attachment.path) ||
          frame.sceneId !== attachment.sceneId || frame.cue !== attachment.cue ||
          frame.viewport !== attachment.viewport || frame.path !== attachment.path ||
          frame.sha256 !== attachment.sha256 || frame.bytes !== attachment.bytes ||
          attachment.mime !== 'image/png' || !isHash(attachment.sha256) ||
          !Number.isInteger(attachment.bytes) || attachment.bytes <= 0 ||
          !Array.isArray(attachment.dimensions) || attachment.dimensions.length !== 2 ||
          attachment.dimensions.some((n, i) => n !== VIEWPORTS[frame.viewport][i]) ||
          !evidence.reviewedItems.includes(frame.sceneId + ':' + frame.cue)) {
        return block('ART_ACCEPTANCE_HOST_FRAME_MISMATCH', 'Frame and observed screenshot metadata do not agree.');
      }
      const capture = checked.index.get(frame.sceneId + ':' + frame.viewport);
      const key = role + ':' + frame.sceneId + ':' + frame.viewport;
      if (!capture || capture.cue !== frame.cue ||
          capture.screenshot !== frame.path || capture.screenshotSha256 !== frame.sha256 ||
          capture.screenshotBytes !== frame.bytes || !required.has(key) ||
          seen.has(key) || observed.has(key)) {
        return block('ART_ACCEPTANCE_HOST_COVERAGE_DUPLICATE_OR_MISMATCH', 'Unrecognized, stale or duplicated scene/viewport/role review: ' + key);
      }
      const file = localPng(projectRoot, attachment.path);
      const actual = file && pngDimensions(file);
      if (!actual || actual.sha256 !== attachment.sha256 || actual.bytes !== attachment.bytes ||
          actual.width !== attachment.dimensions[0] || actual.height !== attachment.dimensions[1]) {
        return block('ART_ACCEPTANCE_HOST_BYTES_MISMATCH', 'Source PNG is missing, changed, or has mismatched actual format/dimensions: ' + attachment.path);
      }
      totalBytes += actual.bytes;
      seen.add(key);
      observed.add(key);
    }
    if (totalBytes > 50_000_000)
      return block('ART_ACCEPTANCE_HOST_ATTACHMENTS_INVALID', 'Host-observed browser turn exceeds the 50 MB image packet budget.');
  }
  if (seen.size !== required.size)
    return block('ART_ACCEPTANCE_HOST_COVERAGE_INCOMPLETE', 'Full three-role x 66-scene x three-viewport acceptance missing ' + (required.size - seen.size) + ' image reviews.');
  return {
    status: 'PASS', assurance: HOST_OBSERVED_ART_ASSURANCE, policy: HOST_OBSERVED_ART_POLICY,
    imageReviews: seen.size, scenes: 66, viewports: 3, roles: VISUAL_REVIEW_ROLES.length,
    providerAttested: false
  };
}
