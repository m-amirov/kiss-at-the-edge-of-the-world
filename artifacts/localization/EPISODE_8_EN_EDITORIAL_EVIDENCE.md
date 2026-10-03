# Episode 8 — English editorial evidence

- Tested source HEAD: `3748a82e2d3ce683e2da02d85b93669c34271c99`.
- Canonical order from `literarySeason.sceneOrder`, RU manuscript, runtime route graph, and localization batch: `S32 → S50 → S33 → S53 → S34 → S56 → S35 → S63`.
- Paragraph slots: `S32=18, S50=9, S33=15, S53=9, S34=17, S56=9, S35=6, S63=7`.

## Authored choices and route predicates

| Scene | Choices | Route/conditional data |
|---|---|---|
| S32 | `S32-C1` | Eric route; route status is `active`, `paused`, or `closed` |
| S50 | `S50-C1`, `S50-C2` | Eric route; chunks gated by `routeStatus=active/paused` |
| S33 | `S33-C1` | Nick route; route status is `active`, `paused`, or `closed` |
| S53 | `S53-C1`, `S53-C2` | Nick route; chunks gated by `routeStatus=active/paused` |
| S34 | `S34-C1` | Damir route; route status is `active`, `paused`, or `closed` |
| S56 | `S56-C1`, `S56-C2` | Damir route; chunks gated by `routeStatus=active/paused` |
| S35 | `S35-C1` | Alice route; independent positive route, no romantic assumption |
| S63 | `S63-C1`, `S63-C2` | Alice route; independent continuation |

Route paths checked from S26 lock:

- Eric: `S27 → S59 → S28 → S49 → S32 → S50`
- Nick: `S27 → S59 → S29 → S52 → S33 → S53`
- Damir: `S27 → S59 → S30 → S55 → S34 → S56`
- Alice: `S27 → S59 → S31 → S62 → S35 → S63`

All Episode 8 scenes contain one extra `C90` beat. No `C91+` beat exists. There are no Episode 8 echoes from earlier episodes; the Episode 7 `S26-C90` echo was checked separately at its canonical insertion point.

## Editorial checks

- English-only cold read, character voice, route-specific continuity, conditional premise, consent/privacy, camera permissions, article/material promises, shared continuation, terminology, and diacritics were reviewed during authoring.
- No source-level defects were found; no bounded RU repair was required.
- Alice remains an independent positive route; Eric, Nick, and Damir inherit only their own intimacy and prior route state.
- Deliberate adaptations preserve modern literary English without strengthening romance or converting ambiguity into commitment.
- Unresolved editorial decision: independent human cold read remains the next gate.

Machine evidence: `artifacts/evidence/ep07-08-route-interaction-continuity.json`.
