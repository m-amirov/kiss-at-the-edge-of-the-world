# Episode 3 — Production English editorial evidence

## Scope and pre-authoring source contract

- Baseline branch: `feature/yandex-sdk-localization`
- Starting HEAD: `86a2105cbb44891ad0a0b96747e036abef1358b6`
- Canonical RU source: `src/literary-season-data.js`, compiled from `content/season-1-literary-episode-03.md`
- Translation batch: `artifacts/localization/translation-input/episode-03.json`
- Runtime scene order: `literarySeason.sceneOrder["3"]` → `S09`, `S10`, `S11`, `S12`
- All four Episode 3 scenes are mandatory; no Episode 5 work is in scope.

The scene order and IDs agree across the current `literarySeason`, the Episode 3 translation batch, and the canonical Russian episode source. No source-contract mismatch was found before authoring.

## Exact scene ledger

| Order | Scene | Canonical title | Chunks | RU paragraphs | Choice IDs | State/predicate structure |
|---:|---|---|---:|---:|---|---|
| 1 | `S09` | Skógafoss, day 5, morning. Not a postcard | 10 | 56 | `S09-C1` | `careerThesis=people`, `careerThesis=place`, `careerThesis=own-choice`; preserves `skogafossVoice` |
| 2 | `S10` | Road to Vík, day 5, afternoon. A song for half an hour | 7 | 52 | `S10-C1` | preserves prior `S01-C1` branch; writes `ericTone` |
| 3 | `S11` | Reynisfjara, day 6, late morning. The shot that will not happen | 10 | 58 | `S11-C1` | preserves `S04-C1` camera-consent branches; writes `consent.camera`/scene-local choice state |
| 4 | `S12` | Vík, day 6, afternoon. Two different towns | 19 | 97 | `S12-C1`, `S12-C2`, `S12-C3` | preserves all three `damir-care` branches and `skogafossVoice`; writes `damirPast`, `draftShared`, and `S12-C3` outcome |

Total: 4 scenes, 46 chunks, 263 RU paragraphs, 6 choice IDs. Chunk and paragraph references are stable `Sxx.Cxxx` / `Sxx.Cxxx.Pxxx` identifiers; technical IDs, option codes, predicates, and state values are not translated.

## Choice and state parity ledger

- `S09-C1`: options A/B/C; writes `skogafossVoice=eric|nick|damir`; later `S13` reads the value.
- `S10-C1`: options A/B; writes `ericTone=playful|quiet`; later `S14` reads the value.
- `S11-C1`: options A/B/C; preserves the camera-consent boundary and writes the scene-local response used by later callbacks.
- `S12-C1`: options A/B; writes `damirPast=listen|pause`.
- `S12-C2`: options A/B; writes `draftShared=damir|private`.
- `S12-C3`: options A/B; controls the immediate post-conversation action and is read by Episode 4.

## Editorial record

- English-only cold read: PASS. The episode reads as one continuous day-5/day-6 travel sequence rather than as sentence-level Russian-to-English substitutions.
- Voice pass: PASS. Alice stays observant and professionally dry; Nick keeps spontaneous camera humor; Eric remains concise and logistical; Damir stays familiar and restrained.
- Semantic and action-ownership pass: PASS. The waterfall, road, beach, Vík conversation, Marina deadline, camera consent, and private-draft boundaries retain their original owners and knowledge timing.
- Choice/state pass: PASS. All six choice IDs, A/B/C option codes, predicates, callbacks, and state writes are preserved without route-graph changes.
- Terminology pass: PASS. Official spellings `Skógafoss`, `Reynisfjara`, and `Vík` are retained; camera, notebook, route, weather, and article terminology is consistent with Episodes 1–2.

### Deliberate adaptation decisions

- The English title and prose keep the contrast between a famous view and the less photogenic place where the group actually waits, listens, and notices other people.
- Nick's film language is rendered as natural production vocabulary (`frame`, `shot`, `camera`, `assignment`) without turning him into a technical narrator.
- Damir's care is shown through tea, pacing, and what he declines to write down; the English does not add a confession or strengthen the romance.
- Marina's article request remains a concrete editorial assignment and deadline pressure, not a generalized emotional metaphor.

### Continuity pass

PASS across Episode 3 and the Episode 2 → Episode 3 boundary. Day/time advances from the previous episode into day 5 morning/afternoon and day 6 late morning/afternoon; the route moves through Skógafoss, the road to Vík, Reynisfjara, and Vík; weather and travel decisions remain bounded by the source. Existing camera-consent state, Alice/Damir history, Eric and Nick callbacks, the notebook, and Marina's assignment are carried forward without contradiction.

## Bounded repair update — 2026-10-02

Audit verdict: `REQUIRES_EP03_EP04_SOURCE_INTERACTION_REPAIR`. The repair was limited to Episode 3–4 refs; Episode 5 was not started.

Source/runtime defects found and repaired:

- `S12.C013.P001`: the EN line incorrectly rendered `вторым` as a deputy/second-in-command role. It now reads “I can’t promise not to be the latter.”
- `S12.C015.P000`: the RU and EN continuation incorrectly added a second pencil purchase. Damir now stops at the car and Alice goes inside the guesthouse; no new purchase is introduced.
- `S11-C91` / runtime `S11-C91`: the extra beat no longer praises Nick for basic safety compliance; it is a route-neutral choice about Alice and Nick walking/listening on the dry path after moving away from the water.

Preserved: scene IDs, authored choice IDs, extra choice IDs (`S11-C90/C91`), option codes, predicates, route graph and save schema. Episode 1–2 English source files remained byte-unchanged. Canonical literary data and the locale bundle were regenerated with `npm run literary:compile`.

The durable semantic runtime record is `artifacts/evidence/ep03-04-interaction-continuity.json`; it covers RU and EN, authored outcomes, both extra beats, and the three requested viewports.

## Unresolved editorial decisions

None. Episode 3 is ready for independent cold read.
