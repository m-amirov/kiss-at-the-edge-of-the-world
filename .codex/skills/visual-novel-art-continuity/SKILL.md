---
name: visual-novel-art-continuity
description: Use for visual-novel asset generation, scene staging and CG integration when character identity, wardrobe, event fidelity or mobile composition must remain continuous.
---

# Visual Novel Art Continuity

## Yandex precedence

This skill is subordinate to current official Yandex Games requirements,
`AGENTS.md`, `PROJECT_RULES.md`, and the configured Starter Kit policies.

## Authority and sources of truth

This skill is subordinate to official Yandex requirements, `AGENTS.md`,
`PROJECT_RULES.md`, `$visual-quality-gate`, `$asset-provenance-and-rights`,
and `$web-game-playtest`. Do not create a second skill root or alter Starter
Kit infrastructure. Consult, in order:

1. `artifacts/art-direction/ART_BIBLE.md`;
2. the character and location master images under `assets/`;
3. `assets/asset-manifest.json` and `assets/provenance/rights-manifest.json`;
4. `docs/VISUAL_EVENTS_2026-09-22.md` and the authored visual-event map;
5. the exact episode Markdown/script and its route/state data.

## Mandatory preflight

- Build a scene/event ledger before generating or assigning an image. Every CG
  must name an existing scene ID, source paragraph/chunk or authored cue,
  location, time, characters present, wardrobe state, emotional beat and
  route condition. A filename or keyword match is not evidence.
- Compare each character against the relevant master for face anchors, hair,
  silhouette, age, wardrobe, props and agency. Never accept a first-generation
  image automatically; reject watermarks, generated text, malformed hands,
  unexplained logos and identity drift.
- Keep a deliberate neutral stage when no truthful asset exists. Do not attach
  a visually attractive CG to an unrelated event (the S02 planning-image
  mismatch is a known regression pattern).

## VN-specific acceptance

- The image must show the authored event, not merely the right place or couple.
- Character count, gaze, touch, prop ownership and route relationship must
  agree with the script; Alice must retain visible agency.
- Preserve wardrobe and weather continuity across adjacent scenes and route
  endings. Domestic epilogues require domestic states, not travel-costume
  substitutions.
- At 390x844 and the declared desktop viewport, faces, hands, key props and
  emotional action remain readable above/around the dialogue panel. Wide CGs
  may use letterbox, but a full-screen emotional beat needs a deliberate
  portrait-safe composition; do not hide controls or crop the speaker.
- Verify the transition into and out of the CG: no stale stage characters,
  wrong background, flash, duplicate character, skipped cue or incorrect
  route state. A CG shown at the wrong transition is a fail even if the image
  itself is attractive.

## Evidence and stop conditions

Persist the ledger, asset IDs, provenance/checksum updates and current-head
runtime screenshots for representative desktop and mobile event transitions.
Use `VISUAL_ACCEPTANCE: FAIL` when capture or source evidence is missing. This
skill cannot approve a release candidate and cannot turn neutral fallback into
complete art coverage.
