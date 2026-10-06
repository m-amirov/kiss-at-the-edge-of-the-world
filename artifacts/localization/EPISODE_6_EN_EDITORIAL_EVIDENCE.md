# Episode 6 English editorial evidence

Status: `READY_FOR_INDEPENDENT_COLD_READ` for the Episode 6 localization scope.

## Canonical scope

The canonical order is read from `literarySeason.sceneOrder["6"]` and the Russian source, not inferred from scene numbering:

`S22 → S23 → S24 → S25 → S58 → S26`

| Scene | RU paragraph slots | Authored choices | Extra interaction choices |
| --- | ---: | --- | --- |
| S22 | 60 | S22-C1, S22-C2 | S22-C90, S22-C91 |
| S23 | 65 | S23-C1 | S23-C90, S23-C91 |
| S24 | 55 | S24-C1 | S24-C90, S24-C91 |
| S25 | 56 | S25-C1 | S25-C90, S25-C91 |
| S58 | 47 | S58-C1 | S58-C90, S58-C91 |
| S26 | 66 | S26-C1 | S26-C90, S26-C91 |

Total: **349 paragraph slots**, 7 authored choices, and 12 extra interaction choices.

## Route and predicate parity

- `S26-C1` is the only route-changing authored choice in Episodes 5–6. Its option mapping remains exactly `A=routeIntent=eric`, `B=routeIntent=nick`, `C=routeIntent=damir`, `D=routeIntent=alice`.
- Earlier evening/weather/state predicates remain stable, including `weatherChoice`, `eveningState`, `S22-C2`, `S23-C1`, `S24-C1`, `S25-C1`, and `S58-C1` references.
- The EN localization does not alter route selection, next-scene transitions, ending logic, or save structure.

## Interaction continuity audit

Every scene was checked for both extra beats, including the source paragraphs immediately before insertion and every authored branch that can affect the localized flow. The audit confirms that each premise is already present in the RU manuscript, each EN response answers only that premise, and no response invents a relationship fact, promise, consent event, or character knowledge.

The bounded source audit found and repaired these interaction-continuity defects without changing IDs or option codes: `S23-C90` no longer invents Eric's unavailable calling days; `S24-C91` no longer preselects a ten-minute joint viewing and preserves both authored invitations; `S25-C90` is neutral across `eveningState=eric/nick/damir/alice`; `S25-C91` asks for Alice's needed clarity before `S25-C1` without assuming a confirmed interview date; `S58-C90` is neutral across `S58-C1=A/B/C/D`; and `S26-C91` remains valid for the no-romantic-person route D by asking about the principle carried into the decision. The expanded runtime audit checks every authored branch combination, not only representative branch A.

The S26 route-lock transition was checked before and after `S26-C1`, after `S26-C90`, and after `S26-C91`. The S22 echo of `S17-C90` was checked against the Episode 5 premise and retains the original branch semantics.

No additional literary-manuscript continuity defects were found beyond the interaction-layer defects listed above. Those interaction-layer defects were repaired in RU canonical interaction data and EN localization; no further RU manuscript repair was required.

## Cross-episode cold read

The read covers Episode 4 → Episode 5 → Episode 6 and checks travel chronology, the article/editor Marina thread, camera consent and privacy, Alice's notebook/draft promises, Eric's control arc, Nick's filming/editing/trust arc, Damir's past/current-life boundary, evening invitations, route lock, and plausible knowledge after each choice.

## Adaptation decisions

- English syntax is contemporary prose rather than literal Russian word order.
- Alice's decision in S26 remains deliberate and bounded; romance is not strengthened beyond the source.
- Nick's filming/editing vocabulary remains specific and playful without erasing consent.
- Eric's care remains practical and understated; Damir's care remains precise and familiar without exposition.
- Icelandic spelling and diacritics are preserved.

## Verification references

- Structural contract: `tests/narrative/localization-contract.test.mjs`
- Generated bundle: `src/literary-localization-bundle.js`
- Runtime semantic evidence: `artifacts/evidence/ep05-06-interaction-continuity.json`
- Repair evidence: all Episode 6 combinations are recorded per extra beat in `artifacts/evidence/ep05-06-interaction-continuity.json`; the current run reports 156 semantic cases, zero contradictions, zero premature premises, zero canonical-line duplicates, zero invented events, and zero branch-invalid premises.
