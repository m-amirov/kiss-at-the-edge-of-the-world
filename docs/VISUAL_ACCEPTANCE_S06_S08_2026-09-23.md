# Visual acceptance — S06–S08 pilot — 2026-09-23

## Scope

Pilot only. No visual routing changes were made for the other 63 scenes.

| Scene | Visual event | Source address | Cast | Desktop | Portrait | Presentation |
|---|---|---:|---|---|---|---|
| S06 | `s06-eric-alice-stream` | `[6,6]` | Alice, Eric | `s06-hveragerdi-eric-alice.png` | `s06-hveragerdi-eric-alice-portrait.png` | `cinematic`, no stage sprites |
| S07 | `s07-kitchen-pasta` | `[3,0]` | Alice, Nick, Eric, Damir | `s07-kitchen-pasta.png` | `s07-kitchen-pasta-portrait.png` | `cinematic`, no stage sprites |
| S07 | `s07-kitchen-cards` | `[3,42]` | Alice, Nick, Eric, Damir | `s07-kitchen-cards.png` | `s07-kitchen-cards-portrait.png` | `cinematic`, no stage sprites |
| S08 | `s08-guesthouse-strap` | `[2,0]` | Alice, Damir | `s08-guesthouse-strap.png` | `s08-guesthouse-strap-portrait.png` | `cinematic`, no stage sprites |

## Runtime evidence

Playwright used the existing Windows Chrome executable
`C:\Program Files\Google\Chrome\Application\chrome.exe` against the project
Node server at `http://127.0.0.1:4173/literary.html`. Twelve fresh screenshots
were captured:

- `artifacts/evidence/s06-s08-runtime/1920x900-{s06-eric-alice-stream,s07-kitchen-pasta,s07-kitchen-cards,s08-guesthouse-strap}.png`
- `artifacts/evidence/s06-s08-runtime/390x844-{s06-eric-alice-stream,s07-kitchen-pasta,s07-kitchen-cards,s08-guesthouse-strap}.png`
- `artifacts/evidence/s06-s08-runtime/360x640-{s06-eric-alice-stream,s07-kitchen-pasta,s07-kitchen-cards,s08-guesthouse-strap}.png`

The adjacent JSON files persist the runtime readback. All 12 states reported
the expected scene/event/asset, `mode: cinematic`, `stageCount: 0`, and the
artwork rectangle exactly matching the viewport. Portrait states loaded the
independent `*-portrait.png` assets. The dialogue layer stayed within the
viewport; faces, hands and authored props remained visible.

## Verification

- `npm run literary:compile`: PASS, 66 scenes / 619 chunks.
- `npm run test:narrative`: PASS.
- Pilot visual routing regression: PASS, 12/12 tests; authored beat IDs,
  cast, desktop files, portrait files and `presentation=cinematic` asserted.
- `git diff --check`: PASS.
- Static asset review against the four character masters: PASS for identity,
  wardrobe continuity, authored props and scene-specific interaction.
- Initial native browser failure was reproduced against the wrong URL
  `/src/literary.html`, which returned 404, while an old Python
  `http.server` and the project Node server were simultaneously bound to
  port 4173. The stale Python listener was stopped; only the project Node
  server remained. The correct `/literary.html` URL then loaded in both Codex
  Chromium and Playwright/Windows Chrome.
- The remaining browser console 404 is the conventional `/favicon.ico`
  request; the project page has no favicon link and the server has no such
  file. It does not affect game modules, images, visual events or controls.

## Verdict

`PASS` / `VISUAL_ACCEPTANCE: PASS` for the S06–S08 pilot.

The pilot assets and authored routing pass the current-runtime desktop/mobile
gate. The S08 vehicle introduction remains separate from the corridor repair
and was not incorrectly merged into the cinematic frame. The new approach is
still limited to S06–S08.
