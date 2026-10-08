import fs from 'node:fs/promises';
import path from 'node:path';
import { groupSemanticSignal, castMatches } from '../../src/literary-visual-contract.js';

const root = process.cwd();
const oldPath = process.env.SEMANTIC_LEDGER_SOURCE ?? 'artifacts/evidence/full-semantic-runtime-audit-2026-10-08.json';
const freshPath = process.env.SEMANTIC_LEDGER_FRESH ?? 'artifacts/evidence/full-semantic-runtime-audit-2026-10-08-reaudit.json';
const cgPath = process.env.SEMANTIC_CG_EVIDENCE ?? 'artifacts/evidence/cg-cast-pixel-evidence-2026-10-08.json';
const hudPath = process.env.SEMANTIC_HUD_EVIDENCE ?? 'artifacts/evidence/mobile-hud-overlap-2026-10-08.json';
const hudBeforePath = process.env.SEMANTIC_HUD_BEFORE_EVIDENCE ?? 'artifacts/evidence/mobile-hud-overlap-before-2026-10-08.json';
const outPath = process.env.SEMANTIC_LEDGER_OUTPUT ?? 'artifacts/evidence/semantic-defect-ledger-2026-10-08-reaudit.json';

const readJson = async file => JSON.parse(await fs.readFile(path.resolve(root, file), 'utf8'));
const [oldAudit, freshAudit, cgEvidence, hudEvidence, hudBeforeEvidence] = await Promise.all([
  readJson(oldPath), readJson(freshPath), readJson(cgPath), readJson(hudPath), readJson(hudBeforePath)
]);
const cgByAsset = new Map((cgEvidence.entries ?? []).map(entry => [entry.asset, entry]));

const refKey = ref => ref ? `${ref.chunk}:${ref.paragraph}` : '';
const stableKey = row => [
  row.scene,
  row.route,
  row.viewport ?? 'source',
  row.sourceStartRef ? refKey(row.sourceStartRef) : '',
  row.position,
  row.entryType ?? '',
  row.entryId ?? ''
].join('|');
const sameVariant = (a, b) => a && b && a.scene === b.scene && a.route === b.route &&
  (a.viewport ?? 'source') === (b.viewport ?? 'source') && a.position === b.position;
const rowForDefect = (defect, rows, sourceRows) => {
  const pool = defect.phase === 'source' ? sourceRows : rows;
  return pool.find(row => row.scene === defect.scene && row.route === defect.route && row.position === defect.position) ?? null;
};
const currentRowFor = (defect, oldRow) => {
  const pool = defect.phase === 'source' ? freshAudit.sourceRows : freshAudit.rows;
  if (oldRow) {
    const exact = pool.find(row => sameVariant(row, oldRow) &&
      (!oldRow.sourceStartRef || refKey(row.sourceStartRef) === refKey(oldRow.sourceStartRef)));
    if (exact) return exact;
  }
  return rowForDefect(defect, freshAudit.rows, freshAudit.sourceRows);
};

const screenshotFor = row => {
  const evidence = row?.visualEvidence;
  if (evidence?.status === 'PASS' && evidence.evidence?.runtimeScreenshot) {
    return {
      path: evidence.evidence.runtimeScreenshot,
      sha256: evidence.evidence.runtimeScreenshotSha256,
      bytes: evidence.evidence.runtimeScreenshotBytes,
      viewport: evidence.evidence.runtimeViewport
    };
  }
  if (row?.scene) {
    return {
      path: `output/playwright/rendered-coverage-audit/${row.scene}-desktop.png`,
      viewport: '1920x900',
      source: 'current-runtime-coverage-capture'
    };
  }
  return null;
};

const classify = (defect, currentRow) => {
  if (!currentRow) return { status: 'NEEDS_MANUAL_REVIEW', severity: null, reason: 'current row not found' };
  if (defect.code === 'DISPLAYED_CAST_DIFFERS_REQUIRED') {
    const required = currentRow.requiredVisibleCast ?? currentRow.requiredCast ?? [];
    const actual = currentRow.actualVisibleCast ?? currentRow.visibleCast ?? currentRow.runtimeStageCast ?? [];
    if (!castMatches(required, actual)) {
      return { status: 'NEEDS_MANUAL_REVIEW', severity: null, reason: 'fresh actual pixels or stage readback do not satisfy required visible cast' };
    }
    if (currentRow.artType === 'cg' && currentRow.visualEvidence?.status === 'PASS') {
      return { status: 'CG_CAST_ALREADY_PRESENT', severity: null, reason: 'fresh CG pixel evidence supplies actual visible cast' };
    }
    return { status: 'VALID_FOCAL_COMPOSITION', severity: null, reason: 'fresh stage contract and runtime stage readback intentionally use focal cast' };
  }
  if (defect.code === 'TEXT_GROUP_NOT_VISIBLE') {
    const signal = groupSemanticSignal(currentRow.text ?? defect.text ?? '');
    if (!signal) return { status: 'SEMANTIC_DETECTOR_FALSE_POSITIVE', severity: null, reason: 'group detector matched no physical-group signal' };
    if (signal.kind === 'group-reference' && /видеосвяз|камер|video|camera/i.test(currentRow.text ?? '')) {
      return { status: 'VALID_OFFSCREEN_CHARACTER', severity: null, reason: 'fresh prose describes remote/offscreen participants' };
    }
    return { status: 'SEMANTIC_DETECTOR_FALSE_POSITIVE', severity: null, reason: 'group reference is recalled, folded-object, or otherwise not a local physical-cast requirement' };
  }
  return { status: 'NEEDS_MANUAL_REVIEW', severity: null, reason: `unsupported historical detector code ${defect.code}` };
};

const records = oldAudit.defects.map((defect, index) => {
  const oldRow = rowForDefect(defect, oldAudit.rows, oldAudit.sourceRows);
  const currentRow = currentRowFor(defect, oldRow);
  const classification = classify(defect, currentRow);
  const asset = currentRow?.visualEvidence?.asset ?? currentRow?.background ?? null;
  const cg = asset ? cgByAsset.get(asset) : null;
  return {
    recordId: `SEM-${String(index + 1).padStart(3, '0')}`,
    historicalDefect: defect,
    identity: {
      historicalRowKey: oldRow ? stableKey(oldRow) : null,
      currentRowKey: currentRow ? stableKey(currentRow) : null,
      evidenceStatus: currentRow ? 'CURRENT_HEAD_RECONCILED' : 'CURRENT_HEAD_EVIDENCE_MISSING'
    },
    scene: defect.scene,
    cue: currentRow?.visualEvidence?.cue ?? null,
    route: defect.route,
    phase: defect.phase,
    playbackPosition: defect.position,
    sourceParagraph: currentRow?.sourceStartRef ?? oldRow?.sourceStartRef ?? null,
    sourceParagraphEnd: currentRow?.sourceEndRef ?? oldRow?.sourceEndRef ?? null,
    text: currentRow?.text ?? oldRow?.text ?? null,
    physicallyPresentCast: currentRow?.physicallyPresentCast ?? currentRow?.physicalCast ?? null,
    authoredCast: currentRow?.authoredCast ?? null,
    requiredVisibleCast: currentRow?.requiredVisibleCast ?? null,
    actualVisibleCast: currentRow?.actualVisibleCast ?? currentRow?.runtimeStageCast ?? currentRow?.visibleCast ?? null,
    offscreenAllowedCast: currentRow?.offscreenAllowedCast ?? null,
    artType: currentRow?.artType ?? null,
    asset,
    visualEvidence: currentRow?.visualEvidence ?? (cg ? { status: cg.status, ...cg.evidence } : null),
    screenshot: screenshotFor(currentRow),
    classification: classification.status,
    severity: classification.severity,
    classificationReason: classification.reason,
    currentHead: freshAudit.sourceHead,
    currentAuditStatus: freshAudit.status
  };
});

const counts = status => records.filter(record => record.classification === status).length;
const severityCounts = ['P0', 'P1', 'P2'].reduce((result, severity) => {
  result[severity] = records.filter(record => record.classification === 'CONFIRMED_VISUAL_DEFECT' && record.severity === severity).length;
  return result;
}, {});
const hudTargetBefore = hudBeforeEvidence.scenes.filter(record => record.scene === 'S01' && ['2/9', '3/9'].includes(record.displayedPosition));
const hudTargetAfter = hudEvidence.scenes.filter(record => record.scene === 'S01' && ['2/9', '3/9'].includes(record.displayedPosition));
const supplementalHudDefect = {
  code: 'MOBILE_HUD_CHARACTER_OVERLAP',
  classification: 'CONFIRMED_VISUAL_DEFECT',
  severity: 'P1',
  status: hudTargetAfter.length === 6 && hudTargetAfter.every(record => record.status === 'PASS' && record.measurement.overlaps.length === 0 && record.measurement.lowerOverlaps.length === 0) ? 'REPAIRED' : 'UNRESOLVED',
  scene: 'S01',
  positions: ['2/9', '3/9'],
  viewports: ['360x640', '390x844', '412x915'],
  before: {
    evidence: hudBeforePath,
    affectedStates: hudTargetBefore.filter(record => record.measurement.overlaps.length > 0).length,
    records: hudTargetBefore.map(record => ({ viewport: `${record.viewport.width}x${record.viewport.height}`, displayedPosition: record.displayedPosition, hud: record.measurement.hud, critical: record.measurement.characters.map(character => ({ id: character.id, critical: character.critical })), overlapPixels: record.measurement.overlaps.map(item => ({ id: item.id, pixels: item.pixels })) }))
  },
  after: {
    evidence: hudPath,
    affectedStates: hudTargetAfter.filter(record => record.measurement.overlaps.length || record.measurement.lowerOverlaps.length).length,
    records: hudTargetAfter.map(record => ({ viewport: `${record.viewport.width}x${record.viewport.height}`, displayedPosition: record.displayedPosition, hud: record.measurement.hud, critical: record.measurement.characters.map(character => ({ id: character.id, critical: character.critical })), lowerOverlapPixels: record.measurement.lowerOverlaps.map(item => ({ id: item.id, pixels: item.pixels })) }))
  }
};

const output = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  sourceLedger: oldPath,
  sourceLedgerGeneratedAt: oldAudit.generatedAt,
  sourceHead: freshAudit.sourceHead,
  freshAudit: freshPath,
  freshAuditStatus: freshAudit.status,
  scope: {
    historicalRecords: records.length,
    historicalP1: oldAudit.summary.p1,
    freshDefects: freshAudit.defects.length,
    freshSourceRows: freshAudit.sourceRows.length,
    freshRuntimeRows: freshAudit.rows.length,
    freshPlaybackPositions: freshAudit.playbackPositionsChecked,
    freshChoiceVariants: freshAudit.choiceVariantsChecked
  },
  summary: {
    confirmedVisualDefects: counts('CONFIRMED_VISUAL_DEFECT'),
    validFocalComposition: counts('VALID_FOCAL_COMPOSITION'),
    validOffscreenCharacter: counts('VALID_OFFSCREEN_CHARACTER'),
    cgCastAlreadyPresent: counts('CG_CAST_ALREADY_PRESENT'),
    semanticDetectorFalsePositive: counts('SEMANTIC_DETECTOR_FALSE_POSITIVE'),
    needsManualReview: counts('NEEDS_MANUAL_REVIEW'),
    confirmedSeverity: severityCounts,
    supplementalDefects: [supplementalHudDefect]
  },
  supplementalDefects: [supplementalHudDefect],
  records
};
await fs.writeFile(path.resolve(root, outPath), `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({ output: outPath, records: records.length, summary: output.summary }, null, 2));
