import { execFileSync } from 'node:child_process';

const EVIDENCE_EXCLUSION = ':(exclude)artifacts/evidence/**';

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function succeeds(root, args) {
  try {
    execFileSync('git', args, { cwd: root, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Release evidence is generated from a product/runtime source commit and then
// committed itself.  Comparing its embedded commit to the evidence commit is a
// self-invalidating cycle, so permit only evidence-only commits after the source.
export function verifyEvidenceSourceIdentity({ root, sourceHead }) {
  if (typeof sourceHead !== 'string' || !/^[0-9a-f]{40}$/i.test(sourceHead)) {
    return { status: 'BLOCKED', code: 'EVIDENCE_SOURCE_HEAD_INVALID', reason: 'Evidence lacks a valid releaseSourceHead.' };
  }
  const currentHead = git(root, ['rev-parse', 'HEAD']);
  if (!succeeds(root, ['merge-base', '--is-ancestor', sourceHead, currentHead])) {
    return { status: 'BLOCKED', code: 'EVIDENCE_SOURCE_HEAD_UNRELATED', reason: 'Evidence releaseSourceHead is not an ancestor of the current release HEAD.' };
  }
  if (!succeeds(root, ['diff', '--quiet', sourceHead, currentHead, '--', '.', EVIDENCE_EXCLUSION])) {
    return { status: 'BLOCKED', code: 'EVIDENCE_SOURCE_STATE_MISMATCH', reason: 'Tracked product/runtime state changed after the evidence releaseSourceHead.' };
  }
  if (!succeeds(root, ['diff', '--quiet', '--', '.', EVIDENCE_EXCLUSION])) {
    return { status: 'BLOCKED', code: 'EVIDENCE_SOURCE_WORKTREE_DIRTY', reason: 'Uncommitted product/runtime changes invalidate release evidence.' };
  }
  return { status: 'PASS', code: null, sourceHead, currentHead };
}
