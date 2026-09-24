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

**PARTIAL.** The live literary runtime opened successfully at `http://127.0.0.1:4173/literary.html`, but the current browser harness did not provide a safe address-level route seeding mechanism for reaching S22–S26 without replaying the full 66-scene reader. Therefore fresh current-HEAD screenshots and runtime readback for all 12 new assets at `1920×900`, `390×844`, and `360×640`, plus before/after checks for all four S26 routes, remain unverified. Full four-route browser regression remains separate and is not promoted by this asset batch.

No release PASS is claimed. The remaining acceptance work is browser capture/readback for S22–S26 at all three viewports, including stage count, actual `img.src`, natural dimensions, overflow and enabled controls.
