# Visual acceptance — S13–S16

Дата: 2026-09-24  
Вердикт партии: **PASS / VISUAL_ACCEPTANCE: PASS**  
S16 medical-help desktop и portrait заменены после `ART_IDENTITY_FAIL`; пострадавшая туристка теперь явно отличается от Алисы.
Общий сезонный PASS не присваивается: 42 из 66 authored scene rows остаются `MISSING_APPROPRIATE_ART`.

## Authored event coverage

| Scene | Visual event | Source address | Cast / situation | Presentation | Assets |
|---|---|---:|---|---|---|
| S13 | `skaftafell-notebook` | `[0,12]` | Alice, Eric, Nick, Damir; trail/block-notebook event | `cinematic` | existing `s13-skaftafell-travelers.png` + portrait |
| S14 | `s14-skaftafell-pace` | `[0,0]`; clear at `[7,0]` | Alice/Eric; pace and thermos conversation | `cinematic` | `s14-skaftafell-pace.png` + portrait |
| S15 | `jokulsarlon-lagoon` | `[0,5]` | existing Jökulsárlón environment | `environment` | existing `jokulsarlon-master.png` |
| S16 | `s16-guesthouse-help` | `[0,0]` | Alice, Damir, Eric, Nick plus two distinct tourists; medical-help event | `cinematic` | `s16-guesthouse-help.png` + portrait |
| S16 | `s16-kitchen-soup` | `[4,0]` | Alice, Damir, Eric, Nick; shared soup continuation | `cinematic` | `s16-kitchen-soup.png` + portrait |

S13 parking remains environment before the existing notebook CG. S14 explicitly clears when the group returns to the road. S16 uses separate medical-help and kitchen compositions; the injured tourist is not visually conflated with Alice.

## Runtime evidence

Native Windows Chrome at `C:\Program Files\Google\Chrome\Application\chrome.exe`, project Node server on `127.0.0.1:4173`, correct URL `/literary.html`. Direct HTTP check returned `200`. Fresh runs started from **Новая игра**.

All four visual events were reached at all required viewports, producing 12 fresh screenshots:

- 1920×900: `artifacts/evidence/s13-s16-runtime/1920x900-skaftafell-notebook.png`, `1920x900-s14-skaftafell-pace.png`, `1920x900-s16-guesthouse-help.png`, `1920x900-s16-kitchen-soup.png`
- 390×844: `artifacts/evidence/s13-s16-runtime/390x844-skaftafell-notebook.png`, `390x844-s14-skaftafell-pace.png`, `390x844-s16-guesthouse-help.png`, `390x844-s16-kitchen-soup.png`
- 360×640: `artifacts/evidence/s13-s16-runtime/360x640-skaftafell-notebook.png`, `360x640-s14-skaftafell-pace.png`, `360x640-s16-guesthouse-help.png`, `360x640-s16-kitchen-soup.png`

Runtime readback confirmed for each event: correct `sceneId` and `visualEventId`, desktop asset on desktop, portrait asset on mobile (`naturalWidth=941`, `naturalHeight=1672`), `mode: cinematic`, `stageCount: 0`, and image rect equal to the viewport. The lower dialogue layer stayed readable and did not cover the central faces/hands/action.

The only repeated browser console 404 is the non-game `/favicon.ico`; `requestfailed` was empty and no game asset failed to load. The current-HEAD runtime captures were visually rechecked in the native Chromium browser after the replacement; the repository helper could not be rerun because this checkout has no locally resolvable `playwright` module (`MODULE_NOT_FOUND`). This is recorded as a tooling limitation, not a product defect.

## Art review

- S14 preserves Alice/Eric masters, travel wardrobe, respectful distance and Alice’s agency in choosing pace.
- S16 medical-help composition preserves all four named characters and uses visibly distinct tourists; hands, water bottle, chair and ankle action are readable.
- S16 kitchen composition is a separate later event with four canonical characters, soup, bread and shared kitchen interaction; it is not reused for the medical event.
- S13 existing CG and S15 existing environment were reused without regeneration or unrelated reassignment.
- Party-wide identity/anatomy review covered S13 desktop+portrait, S14 desktop+portrait, S16 medical-help desktop+portrait and S16 kitchen desktop+portrait. No duplicate main-character identity, malformed hands/limbs, or scenario-mismatched cast/action was found. S15 remains the authored lagoon environment and contains no character duplication surface.

## Coverage totals

The ledger was recalculated against all 66 rows: `MISSING_APPROPRIATE_ART=42`, `REUSE=8`, `COVERED_EVENT=8`, `COVERED_EVENT / UNUSED_ASSET=1`, pilot-accepted rows `S06–S08=3`, and accepted batch rows `S10/S12/S14/S16=4`.

## Verification

- `npm run literary:compile` — `LITERARY_COMPILE_OK 66 scenes 619 chunks`
- `npm run test:narrative` — PASS
- `git diff --check` — PASS
- SHA-256 rechecked against `assets/provenance/rights-manifest.json` for both replacement S16 files — PASS
- Browser acceptance — PASS on current-HEAD Chromium captures; automated helper rerun — BLOCKED by missing local `playwright` dependency (see evidence note above)
