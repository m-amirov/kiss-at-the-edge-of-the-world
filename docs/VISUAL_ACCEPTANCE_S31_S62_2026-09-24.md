# Visual acceptance: S31 + S62 — 2026-09-24

## Scope

Four production PNGs were created and integrated: desktop and independent portrait for S31 and S62. Authored cues are S31 `[0,0]` (`s31-alice-independent-evening`) and S62 `[0,1]` (`s62-alice-bookstore-choice`), both cinematic with `stageCount: 0`.

## Browser evidence

`tools/visual-qa/s31-s62-runtime.mjs` on Windows Chrome produced six fresh screenshots and machine evidence in `artifacts/evidence/s31-s62-runtime-2026-09-24/evidence.json`. All six readbacks matched scene ID, cue and loaded desktop/portrait asset; natural sizes are `1672x941` and `941x1672`; overflow and inner scroll were false; controls were enabled; browser/request errors were zero.

## Independent Web High reviews

- `WEBHIGH-S31-S62-VISUAL-2026-09-24`: actual pixels received; `REWORK`.
- `WEBHIGH-S31-S62-VISUAL-2026-09-24-R2`: actual pixels received for 10/11 supplied images; `FAIL`; confirmed content improvement but key hands/props remained under the dialogue area.
- Final review attempt after the second bounded rework failed at transport: `stream disconnected before completion: ChatGPT did not accept all prompt attachments`. Per the contract this is `BLOCKED`; no automatic regeneration followed the transport failure.

## Current asset/runtime reconciliation

The six Chrome screenshots remain current for the integrated assets: machine
readback reports the expected desktop/portrait filenames and natural sizes for
all six captures, and the current asset SHA-256 values match the provenance
manifest. Current Web High reviews received the three screenshots per scene
plus Alice master-reference in separate small batches:

- `S31-WEBHIGH-20260924-01`: pixels received; `REWORK`.
  - `1920x900`: **not fixed** — lower boardwalk photo remains under dialogue; top of head is cropped.
  - `390x844`: **fixed** — notebook, writing hand, pen and boardwalk photo visible.
  - `360x640`: **not fixed** — lower boardwalk photo remains under dialogue.
- `S62-WEBHIGH-20260924-01`: pixels received; `REWORK`.
  - `1920x900`: **not fixed** — top of head is cropped; book and both hands are visible.
  - `390x844`: **not fixed** — top of hair is cropped; book, hands and recipe structure are visible.
  - `360x640`: **fixed** — head, book, both hands, kitchen photos and recipe structure visible.

The remaining defects are confirmed visual defects, not transport failures. Per
the task stop-line, no fourth generation or additional repair was started.

## New bounded repair cycle

Before replacing the assets, the current runtime measured the open text-panel
safe areas without changing UI: S31 panel top was `595.875px` at 1920×900 and
`292.125px` at 360×640; S62 panel top was `631.5px` at 1920×900 and
`565.6875px` at 390×844. The panel, fullscreen contract and CSS were not
changed.

Four corrected assets were generated and captured in Chrome. The fresh machine
evidence is again 6/6 captures, with current desktop/portrait assets, zero
errors, `stageCount: 0`, no overflow and no internal scroll. The final Web High
submission used two small batches (S31: three screenshots + master; S62: three
screenshots + master), each with the exact authored story fragment. Both
submissions failed before review completion with:

`stream disconnected before completion: ChatGPT did not accept all prompt attachments`

The transport issue was resolved by using one master-reference turn followed
by one screenshot per turn. The final independent review is `PASS` for all six
viewports. No further generation was started.

## Final independent Web High evidence — 2026-09-25

All turns received actual pixels. Runtime screenshot SHA-256 and review trace:

| Scene | Viewport | Screenshot SHA-256 | Trace/review ID | Verdict |
|---|---:|---|---|---|
| S31 | 1920×900 | `80800e30eaad11e11909eb1dc133a0f516f09ed18a1c956cb296d69ecbd2c4fe` | `S31-WEBHIGH-20260925-A1-1920x900` | PASS |
| S31 | 390×844 | `dcf2a6cd0a4d3d17b96cb374499de02f2146e935ac20cf7592a3c9de9f187c32` | `S31-WEBHIGH-20260925-A1-390x844` | PASS |
| S31 | 360×640 | `b46afe59caf63bb507ec0b393a21f8bae420da13dd3005d31e1851d13d095711` | `S31-WEBHIGH-20260925-A1-360x640` | PASS |
| S62 | 1920×900 | `b38400bde4a39908e7c0609b4d677213a86801696b8f673604581b6bba56d57b` | `S62-Alice-RUNTIME-20260925-01` | PASS |
| S62 | 390×844 | `16d9a566e1c280d0bf0eb15676459aae90be3218eeee5b4e1a4f50e775c0e8d6` | `S62-Alice-RUNTIME-20260925-02` | PASS |
| S62 | 360×640 | `751f9f64fef4313e44a146ad7258b4fd4a77619bcbfaeb7b4da4d004d0177e7d` | `S62-Alice-RUNTIME-20260925-03` | PASS |

Reviewer confirmed full head visibility, unobscured authored props/actions,
fullscreen composition without empty bands, identity continuity and absence of
romantic characters in all six frames.

## Verdict

`VISUAL_ACCEPTANCE: PASS` — all six current Chrome frames passed independent
Web High review. The full route playthrough and save/load remain separate
unfinished gates. 
