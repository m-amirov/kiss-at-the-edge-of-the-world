# HOST_OBSERVED_ART_ACCEPTANCE_V1

**Scope:** visual/artistic acceptance of «Поцелуй на краю света» only. Does not replace security, SDK, official Yandex external evidence, full-route QA, or provider-attested audits.

## Trust boundary

- Host-observed captures browser-side visible-attachment validation, accepted user-turn acknowledgement (or observed user identity), assistant turn identity and completed response. It does **not** cryptographically attest byte-identical delivery or provider processing.
- Always record providerAttested=false. Provider task/response/trace IDs must be null; never synthesize from DOM or host agent IDs.
- Verify all local PNG files against their matrix SHA-256, bytes and PNG header dimensions, with source HEAD and product-snapshot binding.
- Preserve original reviewer responseText, its SHA-256 and image-specific observations. Unknowns and unresolved REWORK must remain blocked.

## Official acceptance modes

- Schema v3 / strict: unchanged provider-based contract.
- Schema v4 / visual-content: historical diagnostic only; rejected by default release validator (explicit allowLegacyVisualContent only for historical analyses).
- Schema v5 / assurance host-observed-art-v1 / policy HOST_OBSERVED_ART_ACCEPTANCE_V1: approved art-only acceptance.

Required coverage is **66 scenes × 3 screenshots (desktop, portrait390, portrait360) × 3 independent roles = 594 image-role observations**.
Roles: ceos_art_director_web, ceos_bulk_checker_web, ceos_reasoner_web. One role's findings cannot stand in for another.
Review turns may contain 1–10 files and at most 50,000,000 bytes; prefer three viewport files for one scene and one role per turn.
Host-observed Web model: chatgpt-web/gpt-6-sol with high effort. This is a recorded route, not provider attestation.

## Required evidence

Every **actual completed host browser turn** must supply its own JSON review file, with:

- role, phase=acceptance, status=PASS, semanticVerdict=PASS, current sourceHead, actualPixelsReceived=true;
- reviewedItems including sceneId:cue; evidenceRefs, receivedEvidenceRefs using actual compiled attachment refs;
- responseText (verbatim real response), decision, findings=[], unresolved=[], visualEvidence with per-image ref, sceneId, cue, viewport, path, sha256, bytes, observation and verdict=PASS;
- hostObservedReceipt.schema=codex.web.host-observed.receipt.v1; policy=HOST_OBSERVED_ART_ACCEPTANCE_V1; providerAttested=false; providerTaskId=null; providerResponseId=null; reviewTraceId=null; sourceHead, role;
- hostObservedReceipt.route.model=chatgpt-web/gpt-6-sol, reasoningEffort=high, providerAttested=false;
- hostObservedReceipt.browser.traceId and assistantTurnIdentity, submission=accepted, completion=final; either an actually observed userTurnIdentity, OR userTurnIdentity=null with submissionEvidence=user_turn from the real browser-worker accepted-submission acknowledgement. A click/timeout/logical guess alone is not equivalent;
- hostObservedReceipt.response.status=completed and textSha256=SHA-256 of verbatim responseText;
- hostObservedReceipt.attachments array with unique compiled ref, sceneId, cue, relative PNG path, local sha256, bytes and mime=image/png. If upstream cannot emit per-attachment viewport or dimensions, preserve them as null: the validator derives the viewport strictly from visualEvidence and the current runtime matrix, then checks actual local PNG IHDR. Present non-null viewport/dimensions must match; never invent them as host facts.


Requested model/effort values are **host-side routing observations**, not an attested provider-selected route. The adapter must obtain them from the actual DEV request/selection logs; it must not label them provider-attested or fill missing values from a preferred default.

Never convert a legacy S38 diagnostic summary into a passing receipt by guessing missing fields. New browser captures and real three-role turn evidence are necessary.

## Refresh

From the Final RC worktree, after a current-HEAD 66x3 runtime matrix and all 198 three-viewport role-turn records exist:

```powershell
npm run test:art-acceptance
npm run release:evidence:art -- --assurance host-observed-art-v1 `
  --matrix artifacts/evidence/current-runtime-matrix.json `
  --web-reviews 'artifacts/evidence/reviews/turn1.json;artifacts/evidence/reviews/turn2.json;...'
```

The --web-reviews argument must contain all real turn files, not overview summaries. The validator creates acceptance only after the full coverage and provenance checks pass. It does not invoke Web High.

## Release gates

Missing/repeated browser turns, invalid refs, missing or changed PNGs, stale HEAD, wrong role/route, any REWORK or incomplete viewport coverage block. This policy does not grant publication, Draft upload, merge, external Yandex PASS or full-route browser QA PASS.
