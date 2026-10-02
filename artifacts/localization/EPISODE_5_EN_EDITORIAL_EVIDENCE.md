# Episode 5 English editorial evidence

Status: `READY_FOR_INDEPENDENT_COLD_READ` for the Episode 5 localization scope.

## Canonical scope

The canonical order is read from `literarySeason.sceneOrder["5"]` and the Russian source, not inferred from scene numbering:

`S17 → S18 → S19 → S20 → S21 → S61`

| Scene | RU paragraph slots | Authored choices | Extra interaction choices |
| --- | ---: | --- | --- |
| S17 | 75 | S17-C1, S17-C2 | S17-C90, S17-C91 |
| S18 | 75 | S18-C1, S18-C2 | S18-C90, S18-C91 |
| S19 | 97 | S19-C1, S19-C2, S19-C3 | S19-C90, S19-C91 |
| S20 | 56 | S20-C1, S20-C2 | S20-C90, S20-C91 |
| S21 | 23 | S21-C1, S21-C2 | S21-C90, S21-C91 |
| S61 | 34 | S61-C1 | S61-C90, S61-C91 |

Total: **360 paragraph slots**, 12 authored choices, and 12 extra interaction choices.

## State and predicate parity

- Authored IDs and option codes are unchanged from the RU source.
- Stable predicates remain in the localized choice titles, including `weatherChoice`, `eveningState`, and the S17/S18/S19/S20 branch references.
- No new route graph or EN-only state was introduced.
- The S22 interaction echo remains keyed to `S17-C90`; the echo is translated in the generated interaction bundle and does not alter the authored save schema.

## Continuity audit

The cold read covers the end of Episode 4 into all Episode 5 scenes and the hand-off to Episode 6. It checks the travel-day chronology, Höfn location, Marina/article obligations, notebook and draft consent, Eric's pace/control behavior, Nick's filming/privacy behavior, and Damir's past/current-life boundary. The localized prose preserves who knows each fact and does not turn an extra interaction into a new promise, consent event, or relationship fact.

No source-level interaction continuity defect was found. No RU repair was required.

## Adaptation decisions

- Alice stays observant, dry, and professionally precise; her English avoids Russian calques while retaining restraint.
- Nick keeps quick timing and natural camera/editing vocabulary without turning jokes into romantic escalation.
- Eric remains concise and practical; warmth is carried by action and timing.
- Damir's familiarity stays controlled and behavior-led; prior history is not re-explained for emphasis.
- Icelandic names and diacritics, including Höfn and Egilsstaðir, are preserved.
- Choice questions and responses preserve the original consent/privacy boundaries and emotional intensity.

## Verification references

- Structural contract: `tests/narrative/localization-contract.test.mjs`
- Generated bundle: `src/literary-localization-bundle.js`
- Runtime semantic evidence: `artifacts/evidence/ep05-06-interaction-continuity.json`
