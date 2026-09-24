# Visual acceptance: S28 + S49

`VISUAL_ACCEPTANCE: PASS`

Scope is limited to the Eric route scenes S28 and S49. No other scene received
an image or Eric-specific event.

## Authored events

- S28 `s28-hverfjall-hood` at `[0,3]`: the viewpoint beat where Eric catches
  Alice's windblown hood/collar. Cinematic, no stage sprites.
- S49 `s49-reykjahlid-window-dance` at `[0,4]`: the guesthouse-window dance
  beat with Alice holding the chair as Eric turns. The compiled reader maps the
  authored paragraph boundary to `[0,4]`; the event remains bounded to S49.

## Browser evidence

The isolated production runner used Windows Chrome, the production literary
URL without query parameters, the existing save-key bootstrap, and an open
text panel. Six fresh screenshots were captured:

- S28: `output/playwright/s28-s49-runtime-2026-09-24/S28-s28-hverfjall-hood-1920x900.png`
- S28: `output/playwright/s28-s49-runtime-2026-09-24/S28-s28-hverfjall-hood-390x844.png`
- S28: `output/playwright/s28-s49-runtime-2026-09-24/S28-s28-hverfjall-hood-360x640.png`
- S49: `output/playwright/s28-s49-runtime-2026-09-24/S49-s49-reykjahlid-window-dance-1920x900.png`
- S49: `output/playwright/s28-s49-runtime-2026-09-24/S49-s49-reykjahlid-window-dance-390x844.png`
- S49: `output/playwright/s28-s49-runtime-2026-09-24/S49-s49-reykjahlid-window-dance-360x640.png`

`evidence.json` records for every capture: scene ID, visual-event ID, loaded
desktop/portrait asset and natural dimensions, `stageSprites: 0`, open text
layer, no document/body overflow, no inner reader scroll, all visible buttons
enabled and within the viewport, and zero page/request errors.

Visual inspection of the fresh runtime screenshots passed: Alice and Eric are
recognizable against their masters; the S28 hood/sign action and S49 dance /
chair action remain visible above the text panel at both mobile sizes; the
cinematic layers are full-screen and do not receive stage sprites.

## Checks

- `npm run literary:compile` — PASS (`66 scenes`, `619 chunks`)
- `npm run test:narrative` — PASS
- `git diff --check` — PASS
- isolated Chrome runner — PASS (`6 captures`, `0 errors`)

Ledger count after the batch: `38` scenes remain `MISSING_APPROPRIATE_ART`.
