#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { releasePreflight } from './preflight.mjs';

export function verifyLocalFreeze(preflight = releasePreflight()) {
  const blockerCodes = preflight.blockers.map(({ code }) => code);
  const allowed = blockerCodes.length === 1 && blockerCodes[0] === 'EXTERNAL_YANDEX_EVIDENCE';
  return { status: allowed ? 'PASS_FINAL_LOCAL_RC_FREEZE' : 'BLOCKED_FINAL_LOCAL_RC_FREEZE', nextBlocker: allowed ? 'EXTERNAL_YANDEX_EVIDENCE' : null, releasePreflightStatus: preflight.status, blockers: preflight.blockers };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = verifyLocalFreeze(); console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'PASS_FINAL_LOCAL_RC_FREEZE') process.exitCode = 1;
}
