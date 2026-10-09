/**
 * Opt-in content-level Web art review, not cryptographic host delivery attestation.
 * Keeps the game's 66-scene claim source-bound and independent of provider IDs.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const block = (code, reason) => ({ status: 'BLOCKED', code, reason });
const isText = value => typeof value === 'string' && value.trim().length > 0;
const isSha = value => typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
const viewportNames = new Set(['desktop', 'portrait390', 'portrait360']);
const expectedScenes = new Set(Array.from({ length: 66 }, (_, i) => 'S' + String(i + 1).padStart(2, '0')));
export const VISUAL_REVIEW_ROLES = Object.freeze([
  'ceos_reasoner_web', 'ceos_bulk_checker_web', 'ceos_art_director_web'
]);
export const HIGH_RISK_VISUAL_SCENES = Object.freeze([
  'S01', 'S07', 'S18', 'S26', 'S38', 'S44', 'S63'
]);

function physicalFile(root, relative) {
  if (!isText(relative) || path.isAbsolute(relative)) return null;
  const candidate = path.resolve(root, relative);
  const back = path.relative(root, candidate);
  if (!back || back === '..' || back.startsWith('..' + path.sep) || path.isAbsolute(back)) return null;
  if (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) return null;
  const realRoot = fs.realpathSync(root);
  const real = fs.realpathSync(candidate);
  const realBack = path.relative(realRoot, real);
  if (realBack === '..' || realBack.startsWith('..' + path.sep) || path.isAbsolute(realBack)) return null;
  return candidate;
}

/**
 * Runtime coverage: 66 unique scenes, 3 distinct viewports per scene, current
 * screenshot bytes, manifest identity and verified browser readback.
 */
export function verifyVisualContentMatrix({ projectRoot, matrix, sourceHead }) {
  if (matrix?.status !== 'PASS' || matrix?.sourceHead !== sourceHead ||
      matrix?.scope?.expectedScenes !== 66 || matrix?.scope?.coveredScenes !== 66 ||
      matrix?.scope?.captures !== 198 || !Array.isArray(matrix.scenes) ||
      matrix.scenes.length !== 66 || !Array.isArray(matrix.failures) || matrix.failures.length) {
    return block('ART_ACCEPTANCE_CONTENT_MATRIX_INVALID', 'Expected current-source PASS matrix for 66 unique scenes and 198 captures.');
  }
  const index = new Map();
  const paths = new Set();
  const sceneIds = new Set();
  for (const scene of matrix.scenes) {
    if (!expectedScenes.has(scene?.sceneId) || sceneIds.has(scene.sceneId) ||
        !Array.isArray(scene.captures) || scene.captures.length !== 3) {
      return block('ART_ACCEPTANCE_CONTENT_MATRIX_INVALID', 'Scene identities or viewport coverage are incomplete or duplicated.');
    }
    sceneIds.add(scene.sceneId);
    const seen = new Set();
    for (const capture of scene.captures) {
      const viewport = capture?.viewport;
      const name = viewport?.name;
      if (!viewportNames.has(name) || seen.has(name) || capture.sceneId !== scene.sceneId ||
          capture.currentHead !== sourceHead || !isText(capture.cue) ||
          !isText(capture.screenshot) || !isSha(capture.screenshotSha256) ||
          !Number.isInteger(capture.screenshotBytes) || capture.screenshotBytes < 1 ||
          !capture.manifest?.id || !capture.readback ||
          capture.readback.sceneId !== scene.sceneId || capture.readback.assetMatches !== true ||
          capture.readback.overflow !== false || capture.readback.internalScroll !== false ||
          capture.runError || capture.errors?.length || capture.failed?.length ||
          paths.has(capture.screenshot)) {
        return block('ART_ACCEPTANCE_CONTENT_MATRIX_INVALID', 'Invalid scene, viewport, runtime mapping, readback or duplicate screenshot.');
      }
      const expected = name === 'desktop' ? [1920, 900] : name === 'portrait390' ? [390, 844] : [360, 640];
      if (viewport.width !== expected[0] || viewport.height !== expected[1]) {
        return block('ART_ACCEPTANCE_CONTENT_MATRIX_INVALID', 'Viewport dimensions do not match the declared review viewport.');
      }
      const file = physicalFile(projectRoot, capture.screenshot);
      if (!file) return block('ART_ACCEPTANCE_SCREENSHOT_EVIDENCE_MISSING', 'Screenshot missing or outside the repository: ' + capture.screenshot);
      if (fs.statSync(file).size !== capture.screenshotBytes || sha256(file) !== capture.screenshotSha256) {
        return block('ART_ACCEPTANCE_SCREENSHOT_EVIDENCE_HASH_MISMATCH', 'Screenshot changed: ' + capture.screenshot);
      }
      seen.add(name);
      paths.add(capture.screenshot);
      index.set(scene.sceneId + ':' + name, capture);
    }
    if (seen.size !== viewportNames.size) {
      return block('ART_ACCEPTANCE_CONTENT_MATRIX_INVALID', 'Scene is missing a required desktop or portrait viewport.');
    }
  }
  return { status: 'PASS', index, sceneIds };
}

/**
 * Scoped runtime coverage for a bounded host-observed control. This deliberately
 * does not promote a partial matrix to the 66-scene release matrix contract.
 */
export function verifyScopedVisualContentMatrix({ projectRoot, matrix, sourceHead, sceneId }) {
  if (!/^S(0[1-9]|[1-5][0-9]|6[0-6])$/.test(sceneId ?? '') ||
      !['PASS', 'BLOCKED'].includes(matrix?.status) || matrix?.sourceHead !== sourceHead ||
      matrix?.scope?.coveredScenes !== 1 || matrix?.scope?.expectedCaptures !== 3 || matrix?.scope?.captures !== 3 ||
      !Array.isArray(matrix.scenes) || matrix.scenes.length !== 1 ||
      !Array.isArray(matrix.failures) || matrix.failures.length) {
    return block('ART_ACCEPTANCE_SCOPED_MATRIX_INVALID', 'Expected one current-source scene with three clean runtime captures.');
  }
  const scene = matrix.scenes[0];
  if (scene?.sceneId !== sceneId || !Array.isArray(scene.captures) || scene.captures.length !== 3) {
    return block('ART_ACCEPTANCE_SCOPED_MATRIX_INVALID', 'Scoped scene identity or viewport coverage is incomplete.');
  }
  const index = new Map();
  const seen = new Set();
  for (const capture of scene.captures) {
    const viewport = capture?.viewport;
    const name = viewport?.name;
    if (!viewportNames.has(name) || seen.has(name) || capture.sceneId !== sceneId ||
        capture.currentHead !== sourceHead || !isText(capture.cue) ||
        !isText(capture.screenshot) || !isSha(capture.screenshotSha256) ||
        !Number.isInteger(capture.screenshotBytes) || capture.screenshotBytes < 1 ||
        !capture.readback || capture.readback.sceneId !== sceneId ||
        capture.readback.assetMatches !== true || capture.readback.overflow !== false ||
        capture.readback.internalScroll !== false || capture.runError ||
        capture.errors?.length || capture.failed?.length) {
      return block('ART_ACCEPTANCE_SCOPED_MATRIX_INVALID', 'Scoped runtime capture has invalid source, readback, viewport or error state.');
    }
    const expected = name === 'desktop' ? [1920, 900] : name === 'portrait390' ? [390, 844] : [360, 640];
    if (viewport.width !== expected[0] || viewport.height !== expected[1]) {
      return block('ART_ACCEPTANCE_SCOPED_MATRIX_INVALID', 'Scoped viewport dimensions do not match the declared review viewport.');
    }
    const file = physicalFile(projectRoot, capture.screenshot);
    if (!file) return block('ART_ACCEPTANCE_SCREENSHOT_EVIDENCE_MISSING', 'Scoped screenshot missing or outside the repository: ' + capture.screenshot);
    if (fs.statSync(file).size !== capture.screenshotBytes || sha256(file) !== capture.screenshotSha256) {
      return block('ART_ACCEPTANCE_SCREENSHOT_EVIDENCE_HASH_MISMATCH', 'Scoped screenshot changed: ' + capture.screenshot);
    }
    seen.add(name);
    index.set(sceneId + ':' + name, capture);
  }
  return { status: 'PASS', index, sceneIds: new Set([sceneId]) };
}

export function verifyVisualContentReviews({ projectRoot, matrix, sourceHead, reviewEntries }) {
  const checked = verifyVisualContentMatrix({ projectRoot, matrix, sourceHead });
  if (checked.status !== 'PASS') return checked;
  if (!Array.isArray(reviewEntries) || reviewEntries.length < VISUAL_REVIEW_ROLES.length) {
    return block('ART_ACCEPTANCE_WEB_REVIEW_MISSING', 'Independent Web review records from all three roles are required.');
  }
  const roles = new Set();
  const reviewedSceneIds = new Set();
  const reviewedViewports = new Map();
  const reviewFiles = new Set();
  for (const { reference, evidence } of reviewEntries) {
    const role = evidence?.role ?? evidence?.agent;
    if (!VISUAL_REVIEW_ROLES.includes(role) || role !== reference?.role ||
        evidence?.sourceHead !== sourceHead || evidence?.status !== 'PASS' ||
        evidence?.phase !== 'acceptance' || evidence?.actualPixelsReceived !== true ||
        (evidence.semanticVerdict != null && evidence.semanticVerdict !== 'PASS') ||
        !isText(evidence.decision) || evidence.decision.trim().length < 25 ||
        !Array.isArray(evidence.findings) || evidence.findings.length > 0 ||
        !Array.isArray(evidence.unresolved) || evidence.unresolved.length > 0 ||
        !Array.isArray(evidence.reviewedItems) || evidence.reviewedItems.length === 0 ||
        !evidence.reviewedItems.every(isText) ||
        !Array.isArray(evidence.evidenceRefs) || !evidence.evidenceRefs.length ||
        !evidence.evidenceRefs.every(isText) ||
        !Array.isArray(evidence.receivedEvidenceRefs) ||
        !evidence.receivedEvidenceRefs.every(isText) ||
        !Array.isArray(evidence.visualEvidence) ||
        evidence.visualEvidence.length !== evidence.evidenceRefs.length ||
        !isText(reference.path) || reviewFiles.has(reference.path)) {
      return block('ART_ACCEPTANCE_CONTENT_REVIEW_INVALID', 'Web review missing actual pixel receipt, evidence, independent decision or clean PASS: ' + (reference?.path ?? '?'));
    }
    reviewFiles.add(reference.path);
    roles.add(role);
    const refs = new Set(evidence.evidenceRefs);
    const received = new Set(evidence.receivedEvidenceRefs);
    const frames = new Set();
    if (refs.size !== evidence.evidenceRefs.length || received.size !== evidence.receivedEvidenceRefs.length ||
        !evidence.evidenceRefs.every(ref => received.has(ref))) {
      return block('ART_ACCEPTANCE_PIXEL_RECEIPT_MISSING', 'Web review did not confirm receipt of every supplied image.');
    }
    for (const frame of evidence.visualEvidence) {
      if (!isText(frame?.ref) || !refs.has(frame.ref) || frames.has(frame.ref) ||
          !/^S\d{2}$/.test(frame.sceneId ?? '') || !viewportNames.has(frame.viewport) ||
          !isText(frame.path) || !isSha(frame.sha256) ||
          !isText(frame.observation) || frame.observation.trim().length < 30 ||
          (frame.verdict != null && frame.verdict !== 'PASS') ||
          (frame.received != null && frame.received !== true)) {
        return block('ART_ACCEPTANCE_CONTENT_REVIEW_INVALID', 'Each supplied frame needs a unique identity, SHA-256 and specific visual observation.');
      }
      frames.add(frame.ref);
      const capture = checked.index.get(frame.sceneId + ':' + frame.viewport);
      if (!capture || capture.screenshot !== frame.path ||
          capture.screenshotSha256 !== frame.sha256 ||
          !evidence.reviewedItems.some(item => item.startsWith(frame.sceneId + ':'))) {
        return block('ART_ACCEPTANCE_CONTENT_FRAME_MISMATCH', 'Reviewed frame is not bound to this scene/viewport/source matrix: ' + frame.ref);
      }
      reviewedSceneIds.add(frame.sceneId);
      if (!reviewedViewports.has(frame.sceneId)) reviewedViewports.set(frame.sceneId, new Set());
      reviewedViewports.get(frame.sceneId).add(frame.viewport);
    }
    if (frames.size !== refs.size) {
      return block('ART_ACCEPTANCE_PIXEL_RECEIPT_MISSING', 'No per-image observation for one or more received images.');
    }
  }
  for (const role of VISUAL_REVIEW_ROLES) {
    if (!roles.has(role)) return block('ART_ACCEPTANCE_WEB_REVIEW_MISSING', 'No independent review from ' + role);
  }
  if (reviewedSceneIds.size !== 66) {
    return block('ART_ACCEPTANCE_CONTENT_COVERAGE_INCOMPLETE', 'Image-content review covered ' + reviewedSceneIds.size + '/66 distinct scenes.');
  }
  for (const sceneId of HIGH_RISK_VISUAL_SCENES) {
    const found = reviewedViewports.get(sceneId);
    if (!found?.has('desktop') || ![...found].some(view => view.startsWith('portrait'))) {
      return block('ART_ACCEPTANCE_CONTENT_COVERAGE_INCOMPLETE', 'High-risk scene requires independent desktop and portrait review: ' + sceneId);
    }
  }
  return { status: 'PASS', reviewedScenes: reviewedSceneIds.size, reviewRoles: [...roles], assurance: 'visual-content' };
}
