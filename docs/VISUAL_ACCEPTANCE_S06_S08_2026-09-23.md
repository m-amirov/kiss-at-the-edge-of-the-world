# Visual acceptance — S06–S08 pilot — 2026-09-23

## Scope

Pilot only. No visual routing changes were made for the other 63 scenes.

| Scene | Visual event | Source address | Cast | Desktop | Portrait | Presentation |
|---|---|---:|---|---|---|---|
| S06 | `s06-eric-alice-stream` | `[6,6]` | Alice, Eric | `s06-hveragerdi-eric-alice.png` | `s06-hveragerdi-eric-alice-portrait.png` | `cinematic`, no stage sprites |
| S07 | `s07-kitchen-pasta` | `[3,0]` | Alice, Nick, Eric, Damir | `s07-kitchen-pasta.png` | `s07-kitchen-pasta-portrait.png` | `cinematic`, no stage sprites |
| S07 | `s07-kitchen-cards` | `[3,42]` | Alice, Nick, Eric, Damir | `s07-kitchen-cards.png` | `s07-kitchen-cards-portrait.png` | `cinematic`, no stage sprites |
| S08 | `s08-guesthouse-strap` | `[2,0]` | Alice, Damir | `s08-guesthouse-strap.png` | `s08-guesthouse-strap-portrait.png` | `cinematic`, no stage sprites |

## Verification

- `npm run literary:compile`: PASS, 66 scenes / 619 chunks.
- `npm run test:narrative`: PASS.
- Pilot visual routing regression: PASS, 12/12 tests; authored beat IDs,
  cast, desktop files, portrait files and `presentation=cinematic` asserted.
- `git diff --check`: PASS.
- Static asset review against the four character masters: PASS for identity,
  wardrobe continuity, authored props and scene-specific interaction.
- Native Windows Chromium runtime screenshots at 1920×900, 390×844 and
  360×640: BLOCKED by the host browser policy. `http://127.0.0.1:4173` was
  rejected with `ERR_BLOCKED_BY_CLIENT`; `file://` was rejected by the URL
  policy. No screenshot is claimed as current-runtime evidence.

## Verdict

`PARTIAL` / `VISUAL_ACCEPTANCE: BLOCKED`.

The pilot assets and authored routing are integrated, but the mandatory
current-runtime desktop/mobile screenshot gate remains open. The S08 vehicle
introduction remains separate from the corridor repair and was not incorrectly
merged into the cinematic frame.
