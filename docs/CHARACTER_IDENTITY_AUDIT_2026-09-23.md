# Character identity audit — 2026-09-23

## Verdict

`PASS` for the four repaired epilogue CGs and the reviewed existing route-CG set. The original S44–S47 generation batch was rejected for identity drift and replaced using the corresponding `*-master.png` references.

## Acceptance evidence

- Alice: short tousled light-brown bob, amber eyes, facial proportions and burgundy scarf anchor retained in S44, S45, S46 and S47.
- Eric: sandy tousled hair, blue eyes and short beard retained in S44.
- Nick: dark curly hair, warm brown eyes, light stubble and camera-maker visual language retained in S45.
- Damir: black swept hair, dark eyes, facial-hair pattern, cream coat and burgundy scarf retained in S46.

Comparative panels:

- `artifacts/evidence/identity-comparison-alice.svg`
- `artifacts/evidence/identity-comparison-eric.svg`
- `artifacts/evidence/identity-comparison-nick.svg`
- `artifacts/evidence/identity-comparison-damir.svg`

The existing route-CG set (`eric-route-hand`, `nick-route-editing`, `damir-route-letter`, `alice-independent-ending`, `eric-myvattn-dawn`, `nick-akureyri-edit`, `damir-road-letter`) was visually checked against the same masters and retained; no material identity drift was found.

## Scope and limitations

This is an artistic recognizability acceptance, not a substitute for browser/runtime or narrative tests. The repaired files preserve the existing filenames and visual-event routing, so no scenario logic change was required.

## Automated checks

- `npm run literary:compile` — PASS (`66 scenes`, `619 chunks`).
- `npm run test:narrative` — PASS.
- Asset ledger and manifest JSON — PASS.
- Browser launch was attempted through the project preview server; Playwright CLI was blocked by the host because WSL2 is unavailable (`HCS_E_HYPERV_NOT_INSTALLED`). This is recorded as an environment limitation, not a visual identity failure.
