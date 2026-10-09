import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { verifyVisualContentMatrix, verifyVisualContentReviews } from './visual-content-review.mjs';

const DEFAULT_RECORD = 'artifacts/evidence/production-art-acceptance.json';
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const absolute = (root, value) => path.resolve(root, value);
const normalize = value => path.normalize(value).replaceAll('\\', '/').toLowerCase();
const git = (root, args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const block = (code, reason) => ({ status: 'BLOCKED', code, reason });
const STRICT_WEB_MODEL = 'chatgpt-web/gpt-6-sol';
const STRICT_WEB_ROLES = new Set(['ceos_reasoner_web', 'ceos_bulk_checker_web', 'ceos_art_director_web']);
const isText = value => typeof value === 'string' && value.trim().length > 0;
const isSha = value => typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);

/**
 * Strict mode requires a host/provider receipt, not merely IDs copied into a JSON file.
 * This predicate deliberately accepts only the envelope proposed by the bridge contract;
 * it never derives provider identity or delivery state from local filenames or response text.
 */
export function verifyStrictWebReviewReceipt({ reference, evidence, sourceHead } = {}) {
  const receipt = evidence?.hostReceipt;
  const role = evidence?.role ?? evidence?.agent;
  if (!STRICT_WEB_ROLES.has(role) || reference?.role !== role) {
    return block('ART_ACCEPTANCE_WEB_PROVENANCE_MISSING', 'Strict Web review role is missing or does not match the host receipt.');
  }
  if (!isText(evidence?.taskId) || !isText(evidence?.reviewTraceId) ||
      reference?.taskId !== evidence.taskId || reference?.reviewTraceId !== evidence.reviewTraceId ||
      receipt?.provider?.taskId !== evidence.taskId || receipt?.provider?.traceId !== evidence.reviewTraceId ||
      !isText(receipt?.provider?.responseId)) {
    return block('ART_ACCEPTANCE_WEB_PROVENANCE_MISSING', 'Strict Web review requires matching provider task, trace and response identities.');
  }
  if (receipt?.schema !== 'codex.web.receipt.v1' || receipt?.integrity?.status !== 'verified' ||
      receipt?.codex?.agentRole !== role || !isText(receipt.codex.sessionId) ||
      !isText(receipt.codex.turnId) || !isText(receipt.codex.parentThreadId)) {
    return block('ART_ACCEPTANCE_WEB_PROVENANCE_MISSING', 'Strict Web review lacks an authenticated host session/turn/role receipt.');
  }
  if (receipt?.route?.requestedModel !== STRICT_WEB_MODEL || receipt?.route?.selectedModel !== STRICT_WEB_MODEL ||
      receipt?.route?.reasoningEffort !== 'high' || receipt?.route?.attestation !== 'host-authenticated') {
    return block('ART_ACCEPTANCE_WEB_PROVENANCE_MISSING', 'Strict Web review lacks an attested GPT-6 Sol High route.');
  }
  if (receipt?.source?.snapshot !== sourceHead || receipt?.answer?.status !== 'completed' ||
      receipt?.answer?.providerResponseId !== receipt.provider.responseId || !isSha(receipt?.answer?.answerSha256)) {
    return block('ART_ACCEPTANCE_WEB_PROVENANCE_MISSING', 'Strict Web review is not bound to the accepted source and completed provider response.');
  }
  const refs = evidence.evidenceRefs;
  const received = evidence.receivedEvidenceRefs;
  const attachments = receipt?.source?.attachments;
  if (!Array.isArray(refs) || !refs.length || !Array.isArray(received) ||
      new Set(refs).size !== refs.length || new Set(received).size !== received.length ||
      refs.some(ref => !isText(ref) || !received.includes(ref)) ||
      !Array.isArray(attachments) || attachments.length !== refs.length ||
      attachments.some(item => !isText(item?.ref) || !refs.includes(item.ref) ||
        !isText(item.name) || !isText(item.mime) || !Number.isInteger(item.bytes) || item.bytes < 1 || item.bytes > 20_000_000 ||
        !isSha(item.sha256) || item.acceptedUpload !== true || !Number.isInteger(item.deliveredBytes) || item.deliveredBytes < 1 ||
        !isSha(item.deliveredSha256) || !isText(item.deliveryReceipt))) {
    return block('ART_ACCEPTANCE_WEB_ATTACHMENT_INVALID', 'Strict Web review lacks a complete accepted-upload and delivered-attachment receipt.');
  }
  const totalBytes = attachments.reduce((sum, item) => sum + item.deliveredBytes, 0);
  if (attachments.length > 10 || totalBytes > 50_000_000 || new Set(attachments.map(item => item.ref)).size !== attachments.length) {
    return block('ART_ACCEPTANCE_WEB_ATTACHMENT_INVALID', 'Strict Web review attachment receipt exceeds the 10-file or 50 MB packet limit or repeats an attachment ref.');
  }
  return { status: 'PASS' };
}

export function repositoryIdentity(root) {
  const worktreePath = fs.realpathSync(path.resolve(root));
  const commonRaw = git(worktreePath, ['rev-parse', '--git-common-dir']);
  const commonDir = fs.realpathSync(path.resolve(worktreePath, commonRaw));
  let remote = '';
  try { remote = git(worktreePath, ['config', '--get', 'remote.origin.url']).replace(/\.git$/i, '').toLowerCase(); } catch {}
  const localGitIdentity = digest(normalize(commonDir));
  return { algorithm: 'sha256(git-common-dir,origin)', id: digest(JSON.stringify({ localGitIdentity, remote })), localGitIdentity, remote, worktreePath, commonDir };
}

function isProductPath(file) {
  return file === 'index.html' || file === 'literary.html' || file === 'game-spec.yaml' ||
    file.startsWith('assets/') || file.startsWith('src/') || file.startsWith('content/') || file.startsWith('config/');
}

export function productSnapshot(root) {
  const projectRoot = path.resolve(root);
  const files = git(projectRoot, ['ls-files', '-z']).split('\0').filter(Boolean).filter(isProductPath).sort();
  const entries = files.map(file => {
    const absoluteFile = absolute(projectRoot, file);
    if (!fs.existsSync(absoluteFile)) throw new Error(`Product snapshot file is missing: ${file}`);
    return { path: file, sha256: sha256(absoluteFile) };
  });
  return { algorithm: 'sha256(file bytes)', files: entries, sha256: digest(JSON.stringify(entries)) };
}

function verifyJsonEvidence({ projectRoot, reference, sourceHead, requirePixels = false }) {
  if (!reference?.path || !reference?.sha256) return block('ART_ACCEPTANCE_WEB_EVIDENCE_INVALID', 'Web/matrix evidence reference is incomplete.');
  const file = absolute(projectRoot, reference.path);
  if (!fs.existsSync(file)) return block('ART_ACCEPTANCE_WEB_EVIDENCE_MISSING', `Evidence file is missing: ${reference.path}`);
  if (sha256(file) !== reference.sha256) return block('ART_ACCEPTANCE_WEB_EVIDENCE_HASH_MISMATCH', `Evidence hash differs: ${reference.path}`);
  let evidence;
  try { evidence = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (error) { return block('ART_ACCEPTANCE_WEB_EVIDENCE_INVALID', `Evidence JSON is invalid: ${reference.path}: ${error.message}`); }
  if (evidence.sourceHead !== sourceHead && evidence.currentHead !== sourceHead) return block('ART_ACCEPTANCE_EVIDENCE_SOURCE_MISMATCH', `Evidence is not bound to accepted product head: ${reference.path}`);
  if (evidence.status !== 'PASS') return block('ART_ACCEPTANCE_WEB_EVIDENCE_NOT_PASS', `Evidence is not PASS: ${reference.path}`);
  if (requirePixels && (evidence.actualPixelsReceived !== true || reference.actualPixelsReceived !== true)) return block('ART_ACCEPTANCE_PIXEL_RECEIPT_MISSING', `Web visual review lacks actual pixel receipt: ${reference.path}`);
  return { status: 'PASS', evidence };
}

function verifyMatrixScreenshots({ projectRoot, matrix }) {
  for (const scene of matrix.scenes ?? []) {
    for (const capture of scene.captures ?? []) {
      const screenshot = capture.screenshot;
      if (!screenshot?.path || !screenshot.sha256 || !Number.isInteger(screenshot.bytes)) return block('ART_ACCEPTANCE_SCREENSHOT_EVIDENCE_INVALID', `Matrix capture lacks screenshot bytes/hash: ${scene.sceneId}/${capture.viewport}`);
      const file = absolute(projectRoot, screenshot.path);
      if (!fs.existsSync(file)) return block('ART_ACCEPTANCE_SCREENSHOT_EVIDENCE_MISSING', `Matrix screenshot is missing: ${screenshot.path}`);
      if (fs.statSync(file).size !== screenshot.bytes || sha256(file) !== screenshot.sha256) return block('ART_ACCEPTANCE_SCREENSHOT_EVIDENCE_HASH_MISMATCH', `Matrix screenshot hash/size differs: ${screenshot.path}`);
    }
  }
  return { status: 'PASS' };
}

function verifySourceBinding(projectRoot, record, currentHead) {
  const sourceHead = record.sourceProductHead;
  if (!/^[0-9a-f]{40}$/i.test(sourceHead ?? '')) return block('ART_ACCEPTANCE_SOURCE_HEAD_MISSING', 'Acceptance record lacks a 40-character sourceProductHead.');
  try { execFileSync('git', ['merge-base', '--is-ancestor', sourceHead, currentHead], { cwd: projectRoot, stdio: 'ignore' }); }
  catch { return block('ART_ACCEPTANCE_SOURCE_HEAD_NOT_ANCESTOR', `Accepted product head ${sourceHead} is not an ancestor of current HEAD ${currentHead}.`); }
  if (record.repository?.sourceProductHead !== sourceHead) return block('ART_ACCEPTANCE_SOURCE_HEAD_MISMATCH', 'Repository provenance does not repeat sourceProductHead.');
  if (!record.sourceProductSnapshot?.sha256) return block('ART_ACCEPTANCE_SOURCE_SNAPSHOT_MISSING', 'Acceptance record lacks a product source snapshot.');
  let snapshot;
  try { snapshot = productSnapshot(projectRoot); } catch (error) { return block('ART_ACCEPTANCE_SOURCE_SNAPSHOT_INVALID', error.message); }
  if (snapshot.sha256 !== record.sourceProductSnapshot.sha256 || JSON.stringify(snapshot.files) !== JSON.stringify(record.sourceProductSnapshot.files)) return block('ART_ACCEPTANCE_SOURCE_SNAPSHOT_MISMATCH', 'Current product files differ from the accepted source snapshot.');
  return { status: 'PASS', sourceHead, snapshot };
}

export function verifyArtAcceptance({ root, recordPath = DEFAULT_RECORD, recordOverride } = {}) {
  const projectRoot = path.resolve(root ?? process.cwd());
  const recordFile = absolute(projectRoot, recordPath);
  if (!recordOverride && !fs.existsSync(recordFile)) return block('ART_ACCEPTANCE_RECORD_MISSING', `Acceptance record missing: ${recordPath}`);
  let record;
  try { record = recordOverride ?? JSON.parse(fs.readFileSync(recordFile, 'utf8')); }
  catch (error) { return block('ART_ACCEPTANCE_RECORD_INVALID', `Acceptance record is not valid JSON: ${error.message}`); }
  if (record.schemaVersion === 1 || record.schemaVersion === 2) return block('ART_ACCEPTANCE_LEGACY_REATTESTATION_REQUIRED', 'Path-based or self-invalidating acceptance schema requires current re-attestation.');
  if (![3, 4].includes(record.schemaVersion) || record.recordType !== 'production-art-acceptance') return block('ART_ACCEPTANCE_RECORD_INVALID', 'Unsupported acceptance record schema or record type.');
  const visualContent = record.schemaVersion === 4;
  if (visualContent && (record.assurance !== 'visual-content' || record.webHigh?.assurance !== 'visual-content'))
    return block('ART_ACCEPTANCE_ASSURANCE_INVALID', 'Schema v4 requires explicit visual-content assurance on record and Web reviews.');
  if (record.status !== 'PASS' || record.verdict !== 'PASS_PRODUCTION_ART_66_66') return block('ART_ACCEPTANCE_PROVENANCE_INVALID', 'Acceptance record is not a formal PASS_PRODUCTION_ART_66_66 record.');
  if (record.verifier?.type !== 'source-bound-production-art-verifier' || !record.verifier?.source) return block('ART_ACCEPTANCE_PROVENANCE_INVALID', 'Acceptance record lacks source-bound verifier provenance.');

  const currentHead = git(projectRoot, ['rev-parse', 'HEAD']);
  const identity = repositoryIdentity(projectRoot);
  if (record.repository?.id !== identity.id || record.repository?.algorithm !== identity.algorithm) return block('ART_ACCEPTANCE_REPOSITORY_MISMATCH', 'Acceptance record repository identity does not match the current Git repository.');
  const binding = verifySourceBinding(projectRoot, record, currentHead);
  if (binding.status !== 'PASS') return binding;

  if (record.acceptedSceneCoverage?.expected !== 66 || record.acceptedSceneCoverage?.covered !== 66 || record.acceptedSceneCoverage?.remaining !== 0) return block('ART_ACCEPTANCE_COVERAGE_INVALID', 'Acceptance record does not prove 66/66 scene coverage.');
  if (record.placeholders !== 0 || record.brokenPaths !== 0 || record.webHigh?.result !== 'PASS') return block('ART_ACCEPTANCE_GATE_INVALID', 'Formal acceptance record has non-zero placeholders/broken paths or lacks Web High PASS.');

  const manifestFile = absolute(projectRoot, 'assets/asset-manifest.json');
  const rightsFile = absolute(projectRoot, 'assets/provenance/rights-manifest.json');
  if (!fs.existsSync(manifestFile) || !fs.existsSync(rightsFile)) return block('ART_ACCEPTANCE_MANIFEST_MISSING', 'Current asset or rights manifest is missing.');
  if (record.manifestSha256 !== sha256(manifestFile)) return block('ART_ACCEPTANCE_MANIFEST_HASH_MISMATCH', 'Current asset manifest hash differs from the accepted record.');
  if (record.rightsManifestSha256 !== sha256(rightsFile)) return block('ART_ACCEPTANCE_RIGHTS_HASH_MISMATCH', 'Current rights manifest hash differs from the accepted record.');
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  const manifestEntries = [...(manifest.assets ?? []), ...(manifest.previewAssets ?? [])];
  const runtimeMapping = fs.existsSync(absolute(projectRoot, 'src/literary-visual-directions.js')) ? fs.readFileSync(absolute(projectRoot, 'src/literary-visual-directions.js'), 'utf8') : '';
  const transcodeFile = absolute(projectRoot, 'artifacts/evidence/runtime-transcode-acceptance.json');
  const transcode = fs.existsSync(transcodeFile) ? JSON.parse(fs.readFileSync(transcodeFile, 'utf8')) : null;

  for (const asset of record.acceptedAssets ?? []) {
    const file = absolute(projectRoot, asset.path);
    if (!fs.existsSync(file) || sha256(file) !== asset.sha256) return block('ART_ACCEPTANCE_ASSET_HASH_MISMATCH', `Accepted asset hash differs or file is missing: ${asset.path}`);
    if (!manifestEntries.some(entry => entry.path === asset.path)) return block('ART_ACCEPTANCE_MAPPING_MISMATCH', `Accepted asset is absent from the current manifest: ${asset.path}`);
    if (record.compatibility?.manifestMappings === 'PASS' && !runtimeMapping.includes(path.basename(asset.path))) {
      const derived = transcode?.runtimeAssets?.find(item => item.sourcePath === asset.path);
      if (!derived || transcode.status !== 'PASS' || !fs.existsSync(absolute(projectRoot, derived.runtimePath)) || !runtimeMapping.includes(path.basename(derived.runtimePath))) return block('ART_ACCEPTANCE_MAPPING_MISMATCH', `Accepted asset is absent from the current runtime mapping: ${asset.path}`);
    }
  }
  for (const asset of record.runtimeAssets ?? []) {
    const file = absolute(projectRoot, asset.path);
    if (!fs.existsSync(file) || sha256(file) !== asset.sha256) return block('ART_ACCEPTANCE_RUNTIME_ASSET_HASH_MISMATCH', `Runtime asset hash differs or file is missing: ${asset.path}`);
    if (!manifestEntries.some(entry => [entry.runtimePath, entry.runtimePortraitAsset].includes(asset.path))) return block('ART_ACCEPTANCE_RUNTIME_MAPPING_MISMATCH', `Runtime asset is absent from the current manifest: ${asset.path}`);
  }

  const matrixResult = verifyJsonEvidence({ projectRoot, reference: record.evidence?.matrix, sourceHead: binding.sourceHead });
  if (matrixResult.status !== 'PASS') return matrixResult;
  const matrix = matrixResult.evidence;
  if (matrix.scope?.expectedScenes !== 66 || matrix.scope?.coveredScenes !== 66 || matrix.scope?.captures !== 198 || matrix.failures?.length) return block('ART_ACCEPTANCE_COVERAGE_EVIDENCE_INVALID', 'Current matrix does not prove 66 scenes x 3 viewports with zero failures.');
  const screenshotResult = visualContent
    ? verifyVisualContentMatrix({ projectRoot, matrix, sourceHead: binding.sourceHead })
    : verifyMatrixScreenshots({ projectRoot, matrix });
  if (screenshotResult.status !== 'PASS') return screenshotResult;
  const roles = new Set();
  const strictTaskIds = new Set();
  const strictTraceIds = new Set();
  const reviewEntries = [];
  for (const review of record.webHigh.reviews ?? []) {
    const result = verifyJsonEvidence({ projectRoot, reference: review, sourceHead: binding.sourceHead, requirePixels: true });
    if (result.status !== 'PASS') return result;
    if (!visualContent) {
      const strict = verifyStrictWebReviewReceipt({ reference: review, evidence: result.evidence, sourceHead: binding.sourceHead });
      if (strict.status !== 'PASS') return strict;
      if (strictTaskIds.has(result.evidence.taskId) || strictTraceIds.has(result.evidence.reviewTraceId))
        return block('ART_ACCEPTANCE_WEB_PROVENANCE_DUPLICATE', 'Strict Web review task and trace identities must be unique across roles.');
      strictTaskIds.add(result.evidence.taskId);
      strictTraceIds.add(result.evidence.reviewTraceId);
    }
    roles.add(result.evidence.role ?? result.evidence.agent);
    reviewEntries.push({ reference: review, evidence: result.evidence });
  }
  for (const role of ['ceos_reasoner_web', 'ceos_bulk_checker_web', 'ceos_art_director_web']) if (!roles.has(role))
    return block('ART_ACCEPTANCE_WEB_REVIEW_MISSING', `Required Web High role is missing: ${role}`);
  if (visualContent) {
    const contentResult = verifyVisualContentReviews({ projectRoot, matrix, sourceHead: binding.sourceHead, reviewEntries });
    if (contentResult.status !== 'PASS') return contentResult;
  }
  return { status: 'PASS', code: null,
    reason: visualContent ? '66 scenes reviewed at the image-content assurance level with source-bound local screenshot hashes (not provider-attested delivery).' :
      'Current product files, manifests, runtime matrix, hashes and strict Web High reviews match source-bound production-art acceptance.',
    assurance: visualContent ? 'visual-content' : 'strict', recordPath, sourceProductHead: binding.sourceHead };
}

export function persistVerifiedArtAcceptance({ root, record, recordPath = DEFAULT_RECORD } = {}) {
  const result = verifyArtAcceptance({ root, recordPath, recordOverride: record });
  if (result.status !== 'PASS') throw new Error(`${result.code}: ${result.reason}`);
  const file = absolute(path.resolve(root ?? process.cwd()), recordPath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
  return result;
}
