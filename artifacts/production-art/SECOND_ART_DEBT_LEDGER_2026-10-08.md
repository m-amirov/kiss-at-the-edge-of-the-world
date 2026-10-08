# Production Art Debt Ledger — Reframe Batch 2

Date: 2026-10-08  
Source ancestry: `7181c60e3e0236befe915f43e45e90241db78b32` → `b7163bc9ac00f750e5e716b80928feccbf7e797f`  
Scope: authored runtime stage presentation only. No image generation and no CG replacement.

## Batch 2 selection

The post-Batch-1 ranking selected the next eight `REFRAME_STAGE` states by severity and user visibility: all six remaining P1 four-person group states before pair states, followed by the two repeated Jökulsárlón pair states.

| Rank after Batch 1 | Exact cue | Cast preserved | Reframe contract |
|---:|---|---|---|
| 9 | `S05/scene-start` | Alice, Eric, Nick, Damir | `batch2-four-person-depth-s05` |
| 10 | `S07/scene-start` | Alice, Eric, Nick, Damir | `batch2-four-person-depth-s07` |
| 11 | `S11/scene-start` | Alice, Eric, Nick, Damir | `batch2-four-person-depth-s11` |
| 12 | `S16/scene-start` | Alice, Eric, Nick, Damir | `batch2-four-person-depth-s16` |
| 13 | `S22/scene-start` | Alice, Eric, Nick, Damir | `batch2-four-person-depth-s22` |
| 14 | `S58/scene-start` | Alice, Eric, Nick, Damir | `batch2-four-person-depth-s58` |
| 15 | `S15/scene-start` | Alice, Nick | `batch2-pair-depth-s15-opening` |
| 16 | `S15/jokulsarlon-lagoon` | Alice, Nick | `batch2-pair-depth-s15-lagoon` |

Only scale, position/depth, perspective, and desktop/mobile focal framing changed. Group cues retain all four authored characters; S15 remains a two-person beat. No authored prose, choice, route, save/load, SDK, OST, Back, asset file, or accepted Batch 1/Batch 2 CG changed.

## Acceptance evidence

- Before/after runtime captures: `artifacts/evidence/reframe-batch2-2026-10-08/evidence-before.json` and `evidence-after.json`.
- Coverage: 8 cues × previous/target/next × 1920×900 and 390×844 = 48 captures per phase, 96 total; every capture has PNG bytes, SHA-256, dimensions, current source identity and runtime readback.
- Cue/cast/edge/scroll/runtime validator: `validated-evidence.json` — `PASS`.
- Pixel-backed visual regression: `pixel-acceptance.json` — 16 target comparisons, `PASS`.
- Runtime health across the capture set: console errors `0`, failed requests `0`, game-owned 404 `0`, overflow `0`, internal scroll `0`, images ready `96/96`.
- Character continuity: `PASS`; required group cast `4/4` on all eight group targets in after captures, pair cast `2/2` on both S15 targets.

Per-cue visual review (`grounding / scale / spacing / lighting / sticker effect`):

| Exact cue | Mobile 390×844 | Desktop 1920×900 | Visual result |
|---|---|---|---|
| `S05/scene-start` | PASS / PASS / PASS / PASS / PASS | PASS / PASS / PASS / PASS / PASS | four-person road arc; all required cast readable |
| `S07/scene-start` | PASS / PASS / PASS / PASS / PASS | PASS / PASS / PASS / PASS / PASS | kitchen table plane and depth arc preserved |
| `S11/scene-start` | PASS / PASS / PASS / PASS / PASS | PASS / PASS / PASS / PASS / PASS | beach foreground line and cast remain legible |
| `S16/scene-start` | PASS / PASS / PASS / PASS / PASS | PASS / PASS / PASS / PASS / PASS | guesthouse arrival cast remains visible before next CG |
| `S22/scene-start` | PASS / PASS / PASS / PASS / PASS | PASS / PASS / PASS / PASS / PASS | fjord road grounding and staggered depth read |
| `S58/scene-start` | PASS / PASS / PASS / PASS / PASS | PASS / PASS / PASS / PASS / PASS | kitchen group stays anchored without equal-column lineup |
| `S15/scene-start` | PASS / PASS / PASS / PASS / PASS | PASS / PASS / PASS / PASS / PASS | closer two-shot, no head crop, no cast loss |
| `S15/jokulsarlon-lagoon` | PASS / PASS / PASS / PASS / PASS | PASS / PASS / PASS / PASS / PASS | same continuity with lagoon-specific framing |

## Production Reframe Batch 3 acceptance

Source for the bounded repair: `b1e7c4a0622913bb387e8e5c19cbb9c85d09b664` with
only the scoped Batch 3 working-tree changes before the local commit. No image
files were generated or modified.

The next eight ranked `REFRAME_STAGE` cues were repaired:

| Exact cue | Presentation contract |
|---|---|
| `S46/airport-bus` | existing CG, mobile portrait-safe framing via existing derivative |
| `S42/scene-start/A` | runtime cue `s42-harbour-cafe`, existing CG, mobile portrait-safe framing |
| `S42/scene-start/B` | runtime cue `s42-harbour-cafe`, existing CG, mobile portrait-safe framing |
| `S42/scene-start/C` | runtime cue `s42-harbour-cafe`, existing CG, mobile portrait-safe framing |
| `S01/nick-arrives` | cue-owned pair depth, scale and grounding |
| `S18/scene-start` | cue-owned pair depth, scale and grounding |
| `S28/scene-start` | cue-owned pair depth, scale and grounding |
| `S30/scene-start` | cue-owned pair depth, scale and grounding |

Only per-cue stage composition and existing mobile/desktop framing mappings
changed. Batch 1/2 CG files, OST, SDK, narrative, localization, save/load and
Back were not changed. Fresh before/after runtime evidence, including previous
and next regression captures, is stored under
`artifacts/evidence/reframe-batch3-2026-10-08/`; the compact validators report
`validated-evidence.json: PASS` and `pixel-acceptance.json: PASS`. The matrix is
8 cues × previous/target/next × 1920×900 and 390×844 for each phase: 96 PNG
captures total. Runtime health is 0 console errors, 0 failed requests, 0
game-owned 404s and 0 overflow/internal scroll; current target screenshots
were pixel-reviewed on both viewports. Desktop pixels are intentionally
unchanged for the four CG cues because their desktop compositions were already
accepted; their mobile portrait derivatives are the scoped correction.

No cue was reclassified to `NEW_FULL_SCENE_CG_REQUIRED`.

## Remaining debt after Batch 3

| Classification | Remaining |
|---|---:|
| `REFRAME_STAGE` | 10 |
| `NEW_FULL_SCENE_CG_REQUIRED` | 11 |

Remaining `REFRAME_STAGE`: `S33/scene-start`; `S34/scene-start`; `S37/scene-start`; `S49/scene-start`; `S50/scene-start`; `S52/scene-start`; `S55/scene-start`; `S03/editor-call`; `S35/scene-start`; `S41/editor-cafe-call`.

The 11 out-of-scope `NEW_FULL_SCENE_CG_REQUIRED` states remain unchanged: `S02/roadside-cafe`; `S65/scene-start`; `S06/scene-start`; `S08/scene-start`; `S66/scene-start`; `S12/s12-vik-street`; `S18/hofn-lighthouse`; `S59/scene-start`; `S51/scene-start`; `S57/scene-start`; `S44/eric-morning-harbour`.

## Verdict

`PASS_REFRAME_BATCH_2` is issued only after the bounded local commit is created. This ledger is not a release, Yandex-hosted, CG-generation, or publication approval.
