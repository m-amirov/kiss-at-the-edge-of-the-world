# Visual acceptance: S34 and S56

Status: `S34: PASS`, `S56: PASS`.

The four final PNGs are integrated and locally verified against the Alice/Damir masters. S34 uses the authored `[0,3]` entrance beat after the cancelled dinner; S56 uses `[0,0]` only for `S34-C1=A/B`, so the Damir CG does not appear on the closed route or on Eric, Nick, or independent Alice routes. Cinematic rendering keeps `stageCount=0`.

## Local Chrome QA

Runner: isolated Windows Chrome, current HEAD.

Evidence: `artifacts/evidence/s34-s56-runtime-2026-09-25/evidence.json`.

Six captures passed: S34 and S56 at `1920x900`, `390x844`, and `360x640`. All had actual pixels, expected natural dimensions (`1672x941` desktop / `941x1672` portrait), correct scene/cue/asset, `stageCount=0`, edge-to-edge coverage, no overflow, no inner scroll, available controls, and zero JS/request errors.

## Independent Web High

Required master references were supplied through `local_image`. Two S34 desktop transport attempts were made without regenerating the asset:

| Scene | Viewport | Review ID | actualPixelsReceived | Verdict | Remark |
|---|---|---|---|---|---|
| S34 | 1920x900 | `WHVA-S34-20260925-01` | `true` | PASS | Entrance beat, identity, distance, edge-to-edge and action above text layer accepted. |
| S34 | 390x844 | `WHVA-S34-20260925-02` | `true` | REWORK (superseded) | Earlier rubric incorrectly classified runtime reader shell as baked UI/text. Superseded by corrected review `WHVA-S34-20260925-03`. |
| S34 | 390x844 | `WHVA-S34-20260925-03` | `true` | PASS | Production reader UI explicitly treated as expected overlay; underlying CG, authored moment, identity, action, edge-to-edge and no baked UI/text passed. |
| S34 | 360x640 | `WHVA-S34-20260925-04` | `true` | PASS | Corrected rubric; authored moment readable, faces/action safe above dialogue sheet, edge-to-edge, no baked UI/text. |
| S56 | 1920x900 | `WH-S56-RUNTIME-20260925-0952-04` | `true` | PASS | Authored café-musicians moment, identity, runtime-overlay distinction, edge-to-edge and readability passed. |
| S56 | 390x844 | `WH-S56-RUNTIME-390-20260925-0954-05` | `true` | PASS | Mobile composition, faces/action above text layer, edge-to-edge and no baked UI/text passed. |
| S56 | 360x640 | `WH-S56-RUNTIME-360-20260925-0956-06` | `true` | PASS | Narrow mobile composition remained readable; no critical crop, blank bands or baked UI/text. |

S56 master references passed as `WH-S56-MASTERREF-20260925-0950-02` after one attachment-transport retry (30s); raw asset passed as `WH-S56-RAWASSET-20260925-0951-03`. Runtime review passed all three viewports. No rate-limit event occurred; no cooldown beyond the required 20s inter-turn pacing was needed after the successful reference turn. Publication remains pending the requested verification barrier. No asset or runtime code was changed.

Generation attempts: S34=1, S56=1. Final PNG count: 4.

