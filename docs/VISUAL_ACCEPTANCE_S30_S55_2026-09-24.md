# Visual acceptance — S30 / S55 — 2026-09-24

`VISUAL_ACCEPTANCE: PASS`

## Authored mapping

- S30: `s30-damir-sleeve-promise`, source `[2,1]`, conditional `S30-C1=A`; Damir covers the edge of Alice's sleeve after her proposal to discuss the possible future later.
- S55: `s55-shum-first-step`, source `[0,3]`; Alice laughs, Damir turns toward her, and Shum takes his first step after refusing to move.
- Cinematic presentation is active for both events; runtime `stageCount=0`.

## Runtime evidence

Runner: `tools/visual-qa/s30-s55-runtime.mjs`  
Evidence: `output/playwright/s30-s55-runtime-2026-09-24/evidence.json`  
Current runtime: `http://127.0.0.1:4173/literary.html`, isolated Windows Chrome.

| Scene | 1920×900 | 390×844 | 360×640 |
|---|---|---|---|
| S30 | PASS | PASS | PASS |
| S55 | PASS | PASS | PASS |

All six captures reported `errors=0`, `failedReadbacks=0`, fullscreen edge coverage, no document overflow, no inner reader scroll, visible controls, and the authored cue/asset readback. Desktop assets are `1672×941`; portrait assets are `941×1672`.

## Independent Web High review

The reviewer confirmed receipt of all six runtime PNGs plus `alice-master.png` and `damir-master.png` through `local_image`.

- Initial review: `WEBHIGH-S30-S55-VISUAL-2026-09-24-R1`; S30 3/3 PASS; S55 rework was issued from an incorrect interpretation of the next choice page.
- Corrected review: `WEBHIGH-S30-S55-VISUAL-2026-09-24-R2`; S30 3/3 PASS and S55 3/3 PASS after the exact authored excerpt and cue `[0,3]` were supplied.

## Asset checksums

- `s30-damir-sleeve-promise.png`: `3067CF10304648180C9B7FF41066D107D3BF09A081CCB33002517D56489D2A95`
- `s30-damir-sleeve-promise-portrait.png`: `95F352B51C39C318394B673DE98EE66BAFBE34DFFC9189D1B4A7F271505059359`
- `s55-shum-first-step.png`: `CA8A9A595E49101BED5C1753188052392BFECD1C8C72CFE953F489C4D5930A8E`
- `s55-shum-first-step-portrait.png`: `CB6E4B31491E3D14D529B94DEC95D8ECEF345723DAB7D7568FEB2F14384A991E`

Generation attempts: 4 final images generated; one discarded S30 desktop draft contained pseudo-text and one discarded S55 desktop draft contained a baked UI overlay. No accepted image was regenerated after review.
