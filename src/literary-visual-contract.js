const unique = values => [...new Set(values ?? [])];

/**
 * The authored cast is the physical cast of the active beat. A focal stage
 * may intentionally show only the first two members of an ordinary group;
 * an explicit stageComposition takes precedence over legacy requiredCast.
 */
export function requiredVisibleCastForDirection(direction = {}) {
  const cast = unique(direction.cast);
  const required = unique(direction.requiredCast);
  if (direction.stageComposition) return cast;
  if (direction.art?.presentation === 'cinematic') return required.length ? required : cast;
  if (required.length) return required;
  return cast.length > 2 ? cast.slice(0, 2) : cast;
}

export function visualCastContract(direction = {}, { actualVisibleCast, cgVisualEvidence } = {}) {
  const authoredCast = unique(direction.cast);
  const requiredVisibleCast = requiredVisibleCastForDirection(direction);
  const isCg = direction.art?.type === 'cg';
  const visualEvidence = isCg
    ? (cgVisualEvidence ?? { status: 'MISSING', source: 'current-runtime-pixel-evidence-required' })
    : { status: 'DOM_STAGE', source: 'current-runtime-stage-readback' };
  const observedCast = isCg
    ? (visualEvidence.status === 'PASS' ? unique(visualEvidence.actualVisibleCast) : null)
    : (actualVisibleCast == null ? null : unique(actualVisibleCast));
  const offscreenAllowedCast = authoredCast.filter(id => !requiredVisibleCast.includes(id));
  return {
    authoredCast,
    physicallyPresentCast: authoredCast.slice(),
    requiredVisibleCast,
    actualVisibleCast: observedCast,
    offscreenAllowedCast,
    visualEvidence,
    domCastApplicable: !isCg
  };
}

/**
 * Return only language that asserts a physically co-located group. A folded
 * object ("вчетверо") and recalled/remote group references are not a local
 * cast requirement. Scene-specific review can classify group-reference as
 * offscreen or authored prose without treating it as a visual defect.
 */
export function groupSemanticSignal(text = '') {
  if (/\b(?:троих\s+попутчиков|четыре\s+места\s+в\s+машине|three\s+fellow\s+travellers|four\s+seats\s+in\s+the\s+car)\b/iu.test(text)) {
    return { kind: 'physical-group', count: 3 };
  }
  if (/(?:все\s+четверо|all\s+four)/iu.test(text)) {
    return { kind: 'group-reference', count: 4 };
  }
  return null;
}

export function castMatches(required = [], actual = []) {
  const requiredSet = new Set(required);
  const actualSet = new Set(actual);
  return requiredSet.size === actualSet.size && [...requiredSet].every(id => actualSet.has(id));
}
