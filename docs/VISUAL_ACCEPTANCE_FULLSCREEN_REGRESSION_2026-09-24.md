# Fullscreen regression acceptance — 2026-09-24

## Scope

Fresh current-runtime captures for S16 regression and S27, S28, S49 defect scope at `1920×900`, `390×844` and `360×640`.

## Confirmed root cause and repair

The runtime readback showed `.literary-picture` and its `<img>` already covering the complete viewport; the pixels did not. The defect was in the final shared CSS cascade: later portrait-CG rules restored `object-fit: contain`, and the duplicate blurred `::before` continuation plus opaque header occupied edge pixels. The shared contract now disables the duplicate layer, makes the real authored `<img>` `cover` the viewport, and makes the header transparent. This is one shared presentation rule, not a scene-specific patch. S16 had a separate authored-timing defect: its medical CG was mapped to `[0,0]`, before the first manuscript paragraph; the cue is now `[0,1]`, so the first text fragment is presented before the medical image.

## Runtime evidence

Runner: `tools/visual-qa/s22-s26-runtime.mjs`.

Evidence: `output/playwright/fullscreen-regression-2026-09-24/evidence.json`.

- 12 captures: S16, S27, S28, S49 × three viewports.
- Current runtime reports full picture/image bounds (`0,0` to viewport width/height), zero document/body overflow, controls inside viewport, zero page/request errors and no inner reader scroll for the captured states.
- Each screenshot record contains viewport, natural image dimensions, source asset, SHA-256 and byte size.
- Local inspection of the actual PNG pixels confirmed no top/right empty bands in the repaired mobile captures and no desktop side letterbox: S27 boardwalk repair, S28 hood/collar gesture, and S49 dance/chair beat remain visible above the normal text panel. A fresh S16 first-page capture contains no medical CG; the cue capture contains the injured-ankle image.
- The evidence now distinguishes image pixels from DOM geometry: screenshot SHA-256/byte readback is persisted for every capture, while the independent reviewer field remains false until binary image content is demonstrably accepted by that reviewer.

## Independent multimodal verdict

`BLOCKED`.

This session has no available Web route that accepts the local screenshot and reference-image pixels as actual image content. Therefore no independent Web visual PASS is claimed. The runner records `actualPixelsSupplied: false`; local screenshot viewing and DOM/readback remain separate scoped evidence.

## Mechanical checks

- `literary-picture` and `<img>` bounds cover the viewport in all 12 captures.
- No unexplained picture bounds, document overflow or body overflow observed.
- No inner text-layer scrolling in captured states.
- Visible buttons remained enabled and within viewport.
- No page errors or failed requests.
