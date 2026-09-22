# Project Rules

Project-owned extension point. Add game-specific architecture, protected systems, economy, art, save-schema, test and release constraints here. Do not edit `.starter-kit/core/AGENTS_CORE.md` for project-specific exceptions.

## Screenshot Visual Gate extension

`SCREENSHOT_VISUAL_GATE` is mandatory for production-visible passes under the managed engineering and visual-quality contracts. Record any project-specific art language, prohibited patterns, required state matrix, evidence location, and accepted visual baseline here. These rules can be stricter but cannot waive actual-runtime current-HEAD screenshots, affected-state coverage, visual review, or the acceptance-token barrier.

## Narrative and runtime invariants

- **New approved literary canon:** 10 episodes across 21 travel days, route lock at S26. Use `docs/SEASON_1_STORY_ARCHITECTURE.md`, `docs/SEASON_1_SCENE_MATRIX.md`, and `docs/CONCEPT_CANON.md`.
- **Legacy gameplay, not the new-season canon:** `src/season-data.js` remains a separate 12-episode short prototype. Do not claim that completing its four old endings completes the new 10-episode season. The new literary reader currently contains only episodes 1–6 and uses an independent local-only save.
- A release cannot be designated until the full 10-episode authored manuscript, its verified integrated runtime, artwork, safe save migration, four route playthroughs, and platform evidence are complete; run `npm run release:preflight` before any candidate claim.
- The three romantic routes (Eric, Nick, Damir) must remain emotionally distinct and available without a morally predetermined winner. A fourth ending without a romantic relationship is required.
- Choices must produce an observable later scene, dialogue, action, or ending consequence. Route access may not be implemented as a single unexposed sympathy counter.
- No mystery, investigation, supernatural plot, artificial disaster chain, or placeholder art may replace the approved romance/travel premise.
- Exact travel timing, road conditions, and daylight assumptions must respect `docs/ROUTE_VALIDATION.md`; no October F-road excursion without a separately verified safe transport premise.
- The project is not fully ready while required scenes, endings, real visual assets, or fresh narrative/runtime verification are missing.
