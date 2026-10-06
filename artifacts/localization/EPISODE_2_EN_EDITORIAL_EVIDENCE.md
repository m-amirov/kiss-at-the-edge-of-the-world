# Episode 2 English Editorial Evidence

Status: `READY_EP02_EN_FOR_INDEPENDENT_COLD_READ`

## Scope and sources

- Locale: `ru` → `en`
- Canonical source: `src/literary-season-data.js`
- Translation batch: `artifacts/localization/translation-input/episode-02.json`
- Output files: `content/localization/en/S05.json`, `S06.json`, `S07.json`, `S08.json`, `S66.json`
- Episode 1 English baseline: `1926627c26be6ee1d34112b4f88cfef03e330608`
- Episode 1 files were not edited.
- Episode 3 was not started.

## Exact Episode 2 scene list

Canonical order from `literarySeason.sceneOrder[2]` and `episode-02.json`:

`S05 → S06 → S07 → S08 → S66`

| Scene | Canonical title | Paragraphs | Choice chunks | Choice IDs |
|---|---|---:|---:|---|
| S05 | The Road to Hveragerði, Day 3. The Red Band | 103 | 1 | `S05-C1` |
| S06 | The Short Trail. Eric Without Instructions | 101 | 1 | `S06-C2` |
| S07 | The Shared Kitchen. Nick and the Pasta Disaster | 122 | 1 | `S07-C1` |
| S08 | The Guesthouse. The Strap | 107 | 1 | `S08-C1` |
| S66 | Hveragerði, Day 4. Rows Under Glass | 105 | 0 | — |
| **Total** |  | **538** | **4** |  |

## Structural and state parity

The new localization-contract test checks exact scene/chunk/paragraph refs, paragraph order, non-empty English text, and no extra or missing localized refs. It also checks that stable scene/choice IDs and backtick predicates remain present in localized chunk titles.

Preserved predicates and stable references:

- `S05`: `S05-C1`; `weatherChoice=nick`; `weatherChoice=erik`; `weatherChoice=damir`
- `S06`: `S05-C1`; `S01-C1`; `S06-C2`
- `S07`: `S05-C1`; `S01-C1`; `S04-C1`; `S07-C1`; `kitchenArchive=nick`; `kitchenArchive=group`; `kitchenArchive=private`; `S06-C2=A`; `S06-C2=B`
- `S08`: `S05-C1`; `S08-C1`; `damir-care=warm`; `damir-care=neutral`; `damir-care=personal`
- `S66`: `S08-C1`; `S02-C1`

No action ownership, route semantics, choice codes, or state values were translated or changed.

## Continuity findings

- Time continuity: S05 begins on the third morning after the Reykjavík guesthouse; S66 remains on day four in Hveragerði and leads into the day-five Skógafoss plan.
- Location continuity: the route moves from Reykjavík to Hveragerði, the geothermal trail, the guesthouse, and the greenhouse café without introducing an un-authored stop.
- Knowledge continuity: S06 uses the S05 weather choice and the S01 seating choice; S07 uses the S01 seating choice, S04 camera-consent state, and S06-C2; S08 uses the S05 Damir-seat branch and carries the established Brussels history; S66 uses S08 care state and S02 career-thesis state.
- Consent/camera continuity: S05 offers filming without faces unless consent is given; S07 preserves the S04 recording branches and adds explicit permission checks for the kitchen archive; S08 preserves Nick's subject boundary and Damir's request to trim his own footage; S66 keeps Nick's camera in the bag during the shared task.
- Relationship continuity: Alice's dry observation, Nick's performance gradually giving way to sincerity, Eric's practical warmth, and Damir's restrained familiarity remain consistent with Episode 1.
- Editorial continuity: Marina's assignment and the post-day-four first-paragraph pressure resolve in S66 without inventing a new deadline or changing the established assignment.
- Icelandic terminology: `Reykjavík`, `Hveragerði`, `Skógafoss`, and `Akureyri` retain official spelling and diacritics.

## Deliberate adaptation decisions

- Russian `кадр` is rendered as `shot` when referring to Nick's film work and `picture/frame` where the immediate context is a still image or visual composition.
- `съёмка` is rendered as `filming`, `footage`, or `shoot` according to context, preserving Nick's established camera vocabulary.
- Dialogue is idiomatic contemporary English rather than Russian word order: the adaptation preserves dry timing, subtext, consent boundaries, and factual action while avoiding translationese.
- Technical identifiers and state values remain literal, including backtick predicates and stable choice codes.

## QA result

- All Episode 2 source paragraphs represented exactly once: PASS (`538/538` refs).
- Missing English text: PASS (`0`).
- Accidental Cyrillic in Episode 2 user-visible English: PASS (`0`).
- Scene/chunk/paragraph ID parity: PASS.
- Choice/state predicate parity: PASS.
- Newly invented or omitted events: no editorial discrepancy found in the semantic parity pass.
- Episode 1 English changes: PASS (`0` files changed from the accepted baseline).
- Independent English-only cold read: pending by design; this handoff is the requested independent-cold-read boundary.

## Runtime English visual boundary

A post-commit browser smoke was attempted across S05, S06, S07, S08, and S66 at `1920×900`, `390×844`, and `360×640`. The local runtime set `document.documentElement.lang` to `en`, but `literary-player` does not currently load the persisted `content/localization/en/*.json` corpus, so the rendered scene prose remained Russian. This is an existing runtime-integration boundary shared by the accepted Episode 1 localization; no runtime wiring was changed because this task is scoped to Episode 2 authoring only. Static `literary-visual`, reader, interaction, save, and localization contract checks pass; browser English visual acceptance remains outside this authoring commit. The commit was amended afterward only to persist this evidence note; no runtime-bearing file changed.

## Unresolved editorial decisions

None within the authored Episode 2 draft. Independent cold read remains the next acceptance step.
