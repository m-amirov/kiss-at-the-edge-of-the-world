# S22–S26 visual acceptance — 2026-09-24

## Scope

Current authored source and visual map were audited before asset generation. S22 reuses `eastfjords-road-master.png`; no new image was created for that scene. New authored events are S23 `[0,0]`, S24 `[0,0]`, S25 `[0,0]`, and S26 route-lock states Nick `[8,0]`, Damir `[14,0]`, and independent Alice `[20,0]`. The existing Eric embrace remains at `[7,0]`, conditional only on `S26-C1=A`.

## Integrated assets

Six new authored events received independent desktop `1672×941` and portrait `941×1672` compositions: 12 PNG files total. All files are present, listed in `assets/asset-manifest.json`, and byte-matched in `assets/provenance/rights-manifest.json`.

S26 conditions are regression-tested: before the route-lock paragraph no route-specific CG is shown; after the paragraph only the selected route's cast and asset are shown. Eric's embrace remains isolated from B/C/D.

## Automated evidence

- `npm run literary:compile` — PASS (`66 scenes`, `619 chunks`).
- `npm run test:narrative` — PASS (all suites; visual suite `15/15`, including the new S26 non-Eric route test).
- `git diff --check` — PASS.
- Manifest/provenance JSON parse and asset hash check — PASS.

## Browser evidence

**VISUAL_ACCEPTANCE: PASS** for the S22–S26 visual-event batch. The isolated runner `tools/visual-qa/s22-s26-runtime.mjs` uses real `literarySeason`, `compileInteractivePlayback`, the existing `literarySaveKey`, and the production save parser. It does not add URL parameters, production debug controls, or an alternate scene player. The runner produced 36 current-HEAD captures and `evidence.json` in `output/playwright/s22-s26-runtime-2026-09-24/`.

For every target state at `1920×900`, `390×844`, and `360×640`, readback recorded the actual `img.src`, desktop/portrait asset, visual-event ID, presentation mode, natural dimensions, stage count, text-layer visibility, enabled buttons, viewport control bounds and document/body overflow. Result: 36/36 captures, zero page/request errors, zero overflow, zero hidden controls and zero inner text-layer scrolling after the shared cinematic layout correction.

S26 was checked before and after each cue: Eric before `[7,0]` has no CG and after `[7,0]` loads `s26-eric-choice.png`; Nick after `[8,0]` loads `s26-nick-choice.png`; Damir after `[14,0]` loads `s26-damir-choice.png`; independent Alice after `[20,0]` loads `s26-alice-choice.png`. No route displayed another route's CG. Eric's embrace remained conditional on `S26-C1=A`.

The complete four-route season regression remains a separate scope and is not promoted to a season-wide PASS.
