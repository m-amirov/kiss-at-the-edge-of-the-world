# Fullscreen regression acceptance — 2026-09-24

## Scope

Fresh current-runtime captures for S16 regression and S27, S28, S49 defect scope at `1920×900`, `390×844` and `360×640`.

## Confirmed root cause and repair

The runtime readback showed `.literary-picture` and its `<img>` already covering the complete viewport. The defect was in the final shared mobile CSS cascade: a later portrait-CG rule restored `object-fit: contain`, creating dark/empty-looking bands, while a later cinematic header rule used an overly opaque overlay. The shared fullscreen contract now keeps the authored portrait image intact over a full-viewport blurred continuation and uses a translucent header overlay. No scene mapping, script, asset bytes, routes or save logic changed.

## Runtime evidence

Runner: `tools/visual-qa/s22-s26-runtime.mjs`.

Evidence: `output/playwright/fullscreen-regression-2026-09-24/evidence.json`.

- 12 captures: S16, S27, S28, S49 × three viewports.
- Current runtime reports full picture/image bounds (`0,0` to viewport width/height), zero document/body overflow, controls inside viewport, zero page/request errors and no inner reader scroll for the captured states.
- Each screenshot record contains viewport, natural image dimensions, source asset, SHA-256 and byte size.
- Local pixel inspection confirmed the authored actions remain visible: S27 boardwalk repair, S28 hood/collar gesture, S49 dance/chair beat, and S16 injured-ankle assistance.

## Independent multimodal verdict

`BLOCKED`.

This session has no available Web route that accepts the local screenshot and reference-image pixels as actual image content. Therefore no independent Web visual PASS is claimed. The runner records `actualPixelsSupplied: false`; local screenshot viewing and DOM/readback remain separate scoped evidence.

## Mechanical checks

- `literary-picture` and `<img>` bounds cover the viewport in all 12 captures.
- No unexplained picture bounds, document overflow or body overflow observed.
- No inner text-layer scrolling in captured states.
- Visible buttons remained enabled and within viewport.
- No page errors or failed requests.
