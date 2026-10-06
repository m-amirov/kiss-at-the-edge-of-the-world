# Episode 1 English continuation editorial evidence

- Approved baselines: S01 `4f51a057d08e1ab43039d11c657a327f634c58a3`; S02 `e2754b1787c60bfd48a386ffe4dc98431f66eab0`
- Scope: `S65`, `S03`, `S04` only
- Production sources: `content/localization/en/S65.json`, `content/localization/en/S03.json`, `content/localization/en/S04.json`
- Episode 1 order audited: `S01 → S02 → S65 → S03 → S04`
- Paragraph counts: S65 `106`, S03 `91`, S04 `136`
- Choice counts: S65 `0`, S03 `1` (`S03-C1`), S04 `1` (`S04-C1`)

## Editorial workflow

Each scene received an English-only cold read, a voice pass against the approved S01/S02 baseline, a RU-to-EN semantic parity pass, and a choice/state parity audit. The continuity pass then checked the full Episode 1 sequence for character voice, prior-event references, repeated terminology, Alice and Damir's history, Nick's camera language, Eric's route and logistics vocabulary, journalist/editor terminology, and Icelandic spelling.

## Structural and semantic invariants

- Scene IDs, chunk references, choice IDs, option codes, predicates, branching, and action ownership are unchanged.
- S03 preserves `S02-C1`, `S01-C1`, and `S03-C1` conditions; S04 preserves `S04-C1`, `consent.camera=accepted`, `consent.camera=declined_respected`, `consent.camera=negotiated`, `S03-C1=A`, and `S03-C1=B`.
- S65 remains a shared non-choice scene. S03's A/B choice preserves the two distinct conversation endings. S04's A/B/C choice preserves camera consent, negotiation, and refusal semantics.
- No scene introduces a new event, relationship fact, route state, or factual Icelandic location.

## Continuity decisions

- `Reykjavík`, `Þingvellir`, and `Akureyri` retain official Icelandic spelling and diacritics; `Vogar` and `Eastfjords` remain consistent with the established location vocabulary.
- Alice's editor remains Marina; the English uses “piece,” “profiles,” “opening paragraph,” “editor,” and “sidebar” consistently with the journalist assignment established in S02.
- Nick's camera language distinguishes filming, shots, frames, consent, and the film itself; private or accidental material is never silently treated as public footage.
- Eric's route, weather, forecast, road, departure, and logistics vocabulary stays concise and practical.
- Damir's care is shown through restrained actions and explicit boundaries; his previous relationship with Alice remains unresolved without melodrama.

No unresolved editorial decisions remain.

## Final independent repair

The final cold-read repair corrected S04 action ownership at `S04.C005.P035` so Nick, not Alice, is interested in the abandoned mitten. The canonical RU source and EN localization now say that the S03-C1 A acknowledgment happens “by the car” after the pharmacy walk. The remaining repairs are limited to idiomatic editorial wording in S65, S03, and S04; scene order, branching, state predicates, and approved S01/S02 prose remain unchanged.
