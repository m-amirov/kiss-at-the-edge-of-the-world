# Visual acceptance S17–S21 and S61 — 2026-09-24

`VISUAL_ACCEPTANCE: PASS` for the five requested authored events on current HEAD `1028ef18f8cd2bf9c70760f19b3f4e86359cd535`, using the project Node preview server at `http://127.0.0.1:4173/literary.html` and native Windows Chrome.

| Scene | visual-event | desktop asset | portrait asset | mode | stage sprites | dimensions | runtime result |
|---|---|---|---|---|---:|---|---|
| S17 | `s17-hofn-guesthouse` | `s17-hofn-guesthouse.png` | `s17-hofn-guesthouse-portrait.png` | `cg` | 0 | 1672×941 / 941×1672 | PASS |
| S19 | `s19-hofn-pool` | `s19-hofn-pool.png` | `s19-hofn-pool-portrait.png` | `cg` | 0 | 1672×941 / 941×1672 | PASS |
| S20 | `s20-hofn-damir-kitchen` | `s20-hofn-damir-kitchen.png` | `s20-hofn-damir-kitchen-portrait.png` | `cg` | 0 | 1672×941 / 941×1672 | PASS |
| S21 | `s21-alice-hofn-room` | `s21-alice-hofn-room.png` | `s21-alice-hofn-room-portrait.png` | `cg` | 0 | 1672×941 / 941×1672 | PASS |
| S61 | `s61-hofn-streets.png` | `s61-hofn-streets.png` | `s61-hofn-streets-portrait.png` | `background` | 1 | 1672×941 / 941×1672 | PASS |

All 15 captures (1920×900, 390×844, 360×640 for each event) have no document/body horizontal overflow and expose enabled `Меню`, `К выбору` and `Далее` controls. The lower text panel leaves the authored action readable: the four-person shared meal in S17, the pool selfie/camera interaction in S19, the salad preparation and two-person exchange in S20, Alice's letter writing in S21, and Alice's solo Höfn walk in S61. The desktop and portrait compositions were inspected as paired versions; no duplicate character, malformed anatomy, or route-inappropriate cast was found.

Fresh screenshots: `output/playwright/s17-s21-s61-runtime-2026-09-24/`.
Runtime records: `artifacts/evidence/s17-s21-s61-runtime/run.json` and the 15 per-viewport JSON files.

## Playwright hang adjudication

The first click on `Новая игра` completes in 239 ms, changes the live DOM from menu to `S01`, writes `kiss-at-the-edge-of-the-world:literary-draft:v1`, and keeps the URL at `/literary.html`. `page.waitForNavigation()` therefore times out because this is an in-document render, not navigation. Handler execution, DOM replacement and local state are healthy. The test harness was corrected to wait for the expected DOM state and decoded image, with no production runtime change.

The preview emits one non-critical 404 for the absent favicon; there are no page errors or failed image requests in the five-event matrix.

## Separate browser regression

`PARTIAL`: the four-route full playthrough plus save/load did not complete within the bounded native Chrome run and produced no new route completion evidence. The previous evidence remains `NOT_VERIFIED` for Eric, Nick, Damir and Alice; no seasonal PASS or full browser regression PASS is assigned. The exact prior blocker was the invalid navigation wait described above. The bounded follow-up was stopped after it failed to produce route artifacts, so the route gate remains open.

Evidence: `artifacts/evidence/browser-regression-2026-09-24.json`, `artifacts/evidence/browser-regression-s17-s21-s61-2026-09-24.json` (when present).
