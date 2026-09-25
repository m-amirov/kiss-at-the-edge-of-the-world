# Visual acceptance — S37 + S51 — 2026-09-25

## Verdict

`BLOCKED: S51 REWORK_MOBILE_COMPOSITION`

S37 passed Chrome QA and independent Web High review. S51 desktop passed, but the required portrait evidence received a genuine semantic rework verdict; no regeneration was performed automatically.

## Authored scope and cues

- S37: active Eric route, day 18; after the fishing museum, Alice and Eric sit side-by-side in a small Snæfellsnes cafe while Eric tells the childhood family-song story. Cue `[1,2]`, `s37-eric-alice-cafe`.
- S51: day 19 evening; ordinary guesthouse kitchen, potatoes/cards/flour, Eric reaches for the fallen napkin and Alice touches his shoulder so he straightens and smiles. Cue `[0,3]`, `s51-eric-alice-kitchen-cards`.

## S51 mobile safe-zone measurement before repair

Measured against the current portrait asset with `object-fit: cover`, `object-position: 50% 50%`, and the existing production reader:

| viewport | readerTopPx | visible CG | source crop portrait | safeZonePx | safeZoneNormalized |
| --- | ---: | --- | --- | --- | --- |
| 390x844 | 542.5 | y=0..542.5 | x≈84..857, y=0..1672 | x=0..390, y=0..542.5 | viewport y=0..0.643 |
| 360x640 | 315.3125 | y=0..315.3125 | x≈0..941, y≈0..1672 | x=0..360, y=0..315.3125 | viewport y=0..0.493 |

Common source-safe intersection for both mobile viewports: approximately source x=84..857, y=0..824; normalized source x≈0.089..0.911, y≈0..0.493. Therefore the napkin/reach, hands, scarf and faces must be composed inside the upper half of this common source region, not merely above the 390px reader boundary.

Minimal authored visual requirements: Alice and Eric remain recognizable; Alice's burgundy scarf remains visible; Eric's reach toward the fallen napkin and Alice's shoulder contact are jointly legible; the hand/napkin/character relationship reads without inference; tone remains ordinary, warm domestic intimacy without a kiss or stronger invented action.

## Generation

- S37: one production attempt; desktop and portrait generated.
- S51: one production attempt; desktop and portrait generated.
- Raw dimensions: desktop `1672x941`, portrait `941x1672`.

## Chrome QA

Evidence: `output/playwright/s37-s51-runtime-2026-09-25/evidence.json`.

12 captures total (before/after × 3 viewports × 2 scenes): 0 console/request errors, 0 pre-cue art leaks, 0 failed readbacks, `stageCount=0`, no overflow, no inner reader scroll, fullscreen edge-to-edge, correct desktop/portrait assets.

## Independent Web High review

`actualPixelsReceived=true`.

- S37: `WH-VIS-S37-RAW-03`, `WH-VIS-S37-1920-04`, `WH-VIS-S37-390-05`, `WH-VIS-S37-360-06` — PASS.
- S51 raw/desktop: `WH-VIS-S51-RAW-07`, `WH-VIS-S51-1920-08` — PASS.
- S51 mobile: `WH-VIS-S51-390-09`, `WH-VIS-S51-360-10` — `REWORK_MOBILE_COMPOSITION`.

Required repair: preserve current identities and shoulder contact, but recompose both S51 portrait variants so Eric's downward reach and the fallen/picked-up napkin remain unmistakable above the reader at 390×844 and 360×640. Restore Alice's burgundy scarf continuity. Do not add a kiss or stronger intimacy.

## Bounded repair attempt 2

- Generated candidate: `assets/cg/s51-eric-alice-kitchen-cards-portrait-attempt2.png`
- SHA-256: `E904BCB50898FDFA95BB97634A030516A8ED4AC9094CD0478F12C36FB9EF039F`
- Dimensions: `941x1672`; generation attempts: S37=`1`, S51=`2`.
- Raw Web High review: `WEB-HIGH-S51-PORTRAIT-A2-20260925-1219`; `actualPixelsReceived=true`; verdict `REWORK`.

The candidate restores the burgundy scarf and preserves identity, kitchen, rain and restrained tone. It still fails the authored action: Eric is already holding a crumpled napkin rather than reaching toward a visibly fallen napkin, and his torso remains fully bent instead of visibly straightening after Alice's shoulder touch. Attempt 3 requires explicit cause analysis and is not started automatically. The candidate remains separate from the integrated production portrait.

## Final bounded repair attempt 3 contract

Authored action timeline at S51 `[0,3]`:

```text
BEFORE: napkin falls / is down
TARGET CG MOMENT: Eric reaches toward the fallen napkin and begins straightening
AFTER: Eric has already picked it up / holds it
```

Semantic composition contract for attempt 3:

- the napkin is not in Eric's hand;
- the fallen napkin is visibly on the surface/floor;
- Eric's hand reaches toward it;
- Eric's posture shows transition from bending toward straightening;
- Alice is present in the authored interaction;
- Alice's burgundy scarf is clearly visible;
- the action cluster is inside the common mobile safe zone;
- both faces remain readable;
- no invented romantic gesture.

## Gate status

- `literary:compile`: PASS (`66 scenes`, `619 chunks`).
- `test:narrative`: PASS.
- `git diff --check`: PASS before this report.
- Final `starter-kit:self-test`: not run because required visual acceptance is blocked.
- Coverage remains `accepted=48`, `QA_PENDING=2`, `MISSING_APPROPRIATE_ART=16`; S35 remains blocked and untouched.
- No commit or push performed.

## Final attempt 3 result

- Candidate: `assets/cg/s51-eric-alice-kitchen-cards-portrait-attempt3.png`
- SHA-256: `A70F430EEF67C80E2269BD5348226D2F83C491221A804EEE8B84B1F7FE922BE4`
- Local semantic precheck: `FAIL`.
- Scarf, identities and separate napkin are visible, but the fallen napkin and reaching hand are below the common safe zone; the target transition is not mobile-safe. Candidate was rejected before Web High and was not integrated.
- Final: `S51 = BLOCKED: COMPOSITION_BUDGET_EXHAUSTED`; no attempt 4.
- S37 release integration remains accepted; S51 production mapping/manifest/provenance entries were removed from the release diff. All S51 candidates and this evidence report remain separate.
- Final release target: `accepted=49`, `QA_PENDING=0`, `MISSING_APPROPRIATE_ART=17`.
