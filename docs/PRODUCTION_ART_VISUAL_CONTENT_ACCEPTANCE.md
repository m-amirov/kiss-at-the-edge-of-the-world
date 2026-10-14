# Production-art visual-content acceptance (schema v4)

Two opt-in choices: strict v3 (default, trusted task/trace IDs) and visual-content v4 (reviewed image content without provider attestation). Neither modifies the official Yandex external runtime gates.

## Before generating a PASS record

1. Run current-source production-art browser coverage: 66 unique scenes, 198 real screenshots, desktop 1920x900 and portrait 390x844/360x640, zero failures. Keep every screenshot and its SHA-256, source HEAD, manifest mapping and runtime readback.
2. Perform actual independent Web pixel reviews in small sequential batches. Pass image bytes, not paths or descriptions alone. Document the model's specific visual observation for each received frame. A content-level receipt is not proof of remote byte identity.
3. Cover all 66 scenes with at least one reviewed image each. S01, S07, S18, S26, S38, S44 and S63 also require both desktop and portrait reviews. Three review roles must appear: ceos_reasoner_web, ceos_bulk_checker_web and ceos_art_director_web.
4. Each review JSON must carry phase=acceptance, role, status=PASS, sourceHead, actualPixelsReceived=true, decision, reviewedItems, evidenceRefs, receivedEvidenceRefs, findings=[], unresolved=[], and visualEvidence (one entry per image). Optional taskId/reviewTraceId can be null but must never be invented.
5. Each visualEvidence entry: {ref,sceneId,viewport,path,sha256,observation}. ref must be unique in that review and appear in evidenceRefs and receivedEvidenceRefs; frame scene/viewport/path/SHA-256 must exactly match the current runtime matrix. Observation must describe visible content. Review decision must be substantive.
6. Treat REWORK, PASS_WITH_RESERVATIONS, lost attachments, mismatched evidence and unresolved observations as BLOCKED, not as PASS. Historical reports are never silently reclassified.

## Usage

First run: npm run test:art-acceptance

Strict mode: npm run release:evidence:art -- --matrix <matrix.json> --web-reviews "a.json;b.json;c.json"

Visual mode: npm run release:evidence:art -- --assurance visual-content --matrix <matrix.json> --web-reviews "a.json;b.json;c.json;..."

Only when every check succeeds does the command generate artifacts/evidence/production-art-acceptance.json. Snapshot hashes of product files remain checked. Later evidence-only commits need not invalidate the product snapshot. Any product file changes do invalidate it.

Content-level assurance cannot establish authenticated model/transport identity and must not be represented as doing so. It also does not satisfy EXTERNAL_YANDEX_EVIDENCE, platform moderation, or PRE_SUBMIT_READY.
