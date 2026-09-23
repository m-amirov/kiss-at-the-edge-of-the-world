---
name: visual-novel-narrative-qa
description: Use for interactive visual-novel script audits, route testing and narrative acceptance across choices, visual events, saves and endings.
---

# Visual Novel Narrative QA

## Yandex precedence

This skill is subordinate to current official Yandex Games requirements,
`AGENTS.md`, `PROJECT_RULES.md`, and the configured Starter Kit policies.

## Authority and sources of truth

This skill is subordinate to official Yandex requirements, `AGENTS.md`,
`PROJECT_RULES.md`, `$romance-narrative`, `$audit`, `$verification`, and the
project's existing compiler/runtime contracts. The authored Markdown/script and
canon outrank generated data, stale fixtures and inferred dialogue ownership.
Use the script, `docs/SEASON_ARCHITECTURE.md`,
`docs/VISUAL_EVENTS_2026-09-22.md`, route/state code, and persisted test
artifacts as the audit bundle.

## Audit protocol

1. Freeze scope and create a scene/choice ledger before editing anything.
2. Compile from the authored source; do not repair generated artifacts while
   reading. Record every scene, chunk, speaker, choice, condition, state write,
   visual cue, delayed reaction and ending.
3. Traverse every route family and the independent ending with deterministic
   seeds or the project's existing test harness. Include save/load at scene and
   choice boundaries, back/forward pagination, refresh and route restoration.
4. For each choice, prove an authored immediate reaction or delayed payoff.
   Choices that only increment a hidden counter or return to identical prose
   are decorative and fail the audit.
5. Check causal continuity: no character speaks with another character's
   ownership, no event appears before its setup, no route-ending beat is
   reachable without its premise, and no visual event contradicts the current
   location/time/wardrobe/characters.
6. Check pacing and mobile reader behavior at the project's declared 390x844
   and desktop viewports, including long Russian text, choice buttons, CG
   transitions and resume from a saved route.

## Known regression blockers

Treat these as explicit regression tests, not prose advice:

- a CG cannot be assigned by matching a keyword or scenic similarity alone;
- a visual event cannot skip a paragraph, duplicate a stage character or leave
  the prior scene visible behind the new CG;
- S02-style misplacement of a planning CG in a moving-car/cafe sequence fails;
- broad CGs must not reduce the emotional subject to a tiny unreadable strip on
  mobile; dialogue and touch targets remain usable;
- save migration must preserve route choices and resume at the intended scene;
- every route's romance choice must produce authored observable consequence;
- a neutral fallback is an honest missing-art state, not proof of coverage.

## Evidence and verdict

Persist counts and IDs for scenes, chunks, choices, routes, visual events,
save cases and failures. Keep source, compiled data and runtime evidence
separate. Report exact `PASS`, `FAIL`, `BLOCKED` or `ESCALATE`; missing
independent/browser evidence is `BLOCKED`, not a soft pass. This skill does not
authorize content rewrites, release packaging or a Yandex submission by itself.
