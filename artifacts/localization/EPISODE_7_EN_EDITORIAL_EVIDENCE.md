# Episode 7 — English editorial evidence

- Tested source HEAD: `3748a82e2d3ce683e2da02d85b93669c34271c99`.
- Canonical order from `literarySeason.sceneOrder`, RU manuscript, runtime route graph, and localization batch: `S27 → S59 → S28 → S49 → S29 → S52 → S30 → S55 → S31 → S62`.
- Paragraph slots: `S27=15, S59=11, S28=17, S49=13, S29=12, S52=15, S30=16, S55=14, S31=12, S62=8`.

## Authored choices and route chunks

| Scene | Choices | Route/conditional data |
|---|---|---|
| S27 | `S27-C1` | shared; options A/B/C |
| S59 | `S59-C1` | shared; options A/B/C |
| S28 | `S28-C1`, `S28-C2` | Eric route; shared continuation |
| S49 | `S49-C1` | Eric route; chunks conditional on `S28-C2=A/B` |
| S29 | `S29-C1`, `S29-C2` | Nick route; shared continuation |
| S52 | `S52-C1` | Nick route; chunks conditional on `S29-C2=A/B` |
| S30 | `S30-C1`, `S30-C2` | Damir route; shared continuation |
| S55 | `S55-C1` | Damir route; chunks conditional on `S30-C2=A/B` |
| S31 | `S31-C1`, `S31-C2` | Alice route; shared continuation |
| S62 | `S62-C1` | Alice route; chunks conditional on `S31-C2=A/B` |

Shared scenes are `S27, S59`. Route-specific scene/chunk sets are Eric `S28/S49`, Nick `S29/S52`, Damir `S30/S55`, and Alice `S31/S62`. Each scene contains one extra `C90` beat; no `C91+` beat exists in Episode 7.

The only Episode 1–6 interaction echo entering this episode is `S27 ← S26-C90`, with A/B-specific English text. Its source choice, branch, and route-neutral insertion were machine-checked.

## Editorial checks

- English-only cold read, voice pass, RU↔EN semantic parity, speaker/action ownership, pronoun clarity, route continuity, choice/state parity, interaction insertion, terminology, and Icelandic diacritics were reviewed during authoring.
- No source-level defects were found; no RU repair was required.
- Deliberate adaptations: contemporary literary English rather than literal Russian syntax; no added promises, relationship facts, consent events, character knowledge, Iceland facts, or route commitments.
- Unresolved editorial decision: independent human cold read remains the next gate.

Machine evidence: `artifacts/evidence/ep07-08-route-interaction-continuity.json`.
