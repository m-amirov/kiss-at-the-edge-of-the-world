# Episode 4 — Production English editorial evidence

## Scope and pre-authoring source contract

- Baseline branch: `feature/yandex-sdk-localization`
- Starting HEAD: `86a2105cbb44891ad0a0b96747e036abef1358b6`
- Canonical RU source: `src/literary-season-data.js`, compiled from `content/season-1-literary-episode-04.md`
- Translation batch: `artifacts/localization/translation-input/episode-04.json`
- Runtime scene order: `literarySeason.sceneOrder["4"]` → `S13`, `S14`, `S15`, `S16`
- All four Episode 4 scenes are mandatory; Episode 5 is explicitly out of scope.

The scene order and IDs agree across the current `literarySeason`, the Episode 4 translation batch, and the canonical Russian episode source. No source-contract mismatch was found before authoring.

## Exact scene ledger

| Order | Scene | Canonical title | Chunks | RU paragraphs | Choice IDs | State/predicate structure |
|---:|---|---|---:|---:|---|---|
| 1 | `S13` | Day 7. Skaftafell. Four people and one notebook | 11 | 80 | `S13-C1` | reads `skogafossVoice`; reads `S12-C3=A|B`; writes `alice-leads`/equal-collection state |
| 2 | `S14` | Day 7. Trail above the glacier plain. Pace | 11 | 64 | `S14-C1`, `S14-C2` | reads/writes `ericTone`; `S14-C2` writes the Eric response used by S15 |
| 3 | `S15` | Day 8. Jökulsárlón. Not filming means seeing | 11 | 84 | `S15-C1` | reads `skogafossVoice`; reads `S14-C2`; preserves Nick camera-consent boundaries |
| 4 | `S16` | Day 8. Roadside guesthouse. Someone else’s pain | 5 | 40 | `S16-C1` | route-independent Eric support choice; preserves immediate and delayed relationship beats |

Total: 4 scenes, 38 chunks, 268 RU paragraphs, 5 choice IDs. Chunk and paragraph references are stable `Sxx.Cxxx` / `Sxx.Cxxx.Pxxx` identifiers; technical IDs, option codes, predicates, and state values are not translated.

## Choice and state parity ledger

- `S13-C1`: options A/B; preserves the distinction between Alice directing the material and agreeing to equal collection.
- `S14-C1`: options A/B; writes the route/weather pacing result and preserves `ericTone` consequences.
- `S14-C2`: options A/B; writes the immediate Eric-facing response used by `S15`.
- `S15-C1`: options A/B/C; preserves Nick’s consent boundary, private material, and right to stop.
- `S16-C1`: options A/B; preserves practical care without forcing disclosure or romance.

## Editorial record

- English-only cold read: PASS. The episode reads as a continuous day-7/day-8 movement from Skaftafell to the glacier plain, Jökulsárlón, and the roadside guesthouse.
- Voice pass: PASS. Alice remains controlled and observant; Nick's camera humor stays quick but consent-aware; Eric's care is practical and understated; Damir's shared history remains specific without a sentimental register shift.
- Semantic and action-ownership pass: PASS. Notebook ownership, walking pace, weather/logistics, private pain, and the choice to stop filming remain attached to the same speakers and actions as in the RU source.
- Choice/state pass: PASS. All five choice IDs, A/B/C option codes, predicates, route conditions, callbacks, and ending-affecting state are preserved without route-graph changes.
- Terminology pass: PASS. Official spellings `Skaftafell`, `Jökulsárlón`, and `Vík` are retained; glacier, guesthouse, notebook, camera, and road terminology is consistent with Episodes 1–3.

### Deliberate adaptation decisions

- The notebook and collection discussion is phrased as professional fieldwork, keeping Alice's agency distinct from a romantic gesture.
- Pace and weather language stays practical and physical; Eric's support is communicated through route choices and pauses rather than explanation.
- The camera material explicitly keeps the right to stop and the distinction between filming and seeing; no English line strengthens consent or invents a new private disclosure.
- The guesthouse scene uses restrained English for care and unresolved history, preserving the source's emotional intensity without melodrama.

### Continuity pass

PASS across Episode 4 and the Episode 3 → Episode 4 boundary. The route, day/time, accommodation, weather, Marina/article pressure, Alice/Damir history, Eric and Nick progression, notebook/music/camera motifs, and previously learned personal facts remain consistent. `skogafossVoice`, `ericTone`, `S12-C3`, camera consent, and the Episode 3 choice callbacks are carried into the correct Episode 4 scenes.

## Source-level continuity defects

None identified. No `SOURCE_CONTINUITY_DEFECT` was found; no RU repair was required.

## Unresolved editorial decisions

None. Episode 4 is ready for independent cold read.
