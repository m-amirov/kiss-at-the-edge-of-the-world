# Visual acceptance — S09–S12

Дата: 2026-09-24  
Вердикт партии: **PASS / VISUAL_ACCEPTANCE: PASS**  
Общий сезонный PASS не присваивается: следующие сцены ещё не покрыты.

## Authored event scope

| Scene | Visual event | Source | Участники | Mode | Desktop / mobile assets |
|---|---|---:|---|---|---|
| S10 | `s10-vik-road-song` | `[0,0]`; clear at `[6,0]` | Alice, Eric | `cinematic` | `s10-vik-road-song.png` / `s10-vik-road-song-portrait.png` |
| S12 | `s12-vik-cafe-damir` | `[0,0]`; clear at `[11,0]` | Alice, Damir | `cinematic` | `s12-vik-cafe-damir.png` / `s12-vik-cafe-damir-portrait.png` |

S09 and S11 remain authored `environment` coverage: their group movement, safety transitions and changing composition do not justify attaching a single fixed cinematic frame. No new image was generated for them.

## Runtime evidence

Native Windows Chromium (`C:\Program Files\Google\Chrome\Application\chrome.exe`), local server `http://127.0.0.1:4173/literary.html`, fresh run from **Новая игра**. Each event was reached in the working game at all three required sizes; runtime readback recorded `sceneId`, `visualEventId`, loaded `asset`, `desktopAsset`, `mode`, stage count and image/sheet rectangles.

| Viewport | Screenshots |
|---|---|
| 1920×900 | `artifacts/evidence/s09-s12-runtime/1920x900-s10-vik-road-song.png`, `1920x900-s12-vik-cafe-damir.png` |
| 390×844 | `artifacts/evidence/s09-s12-runtime/390x844-s10-vik-road-song.png`, `390x844-s12-vik-cafe-damir.png` |
| 360×640 | `artifacts/evidence/s09-s12-runtime/360x640-s10-vik-road-song.png`, `360x640-s12-vik-cafe-damir.png` |

All six readbacks reported `mode: cinematic`, `stageCount: 0`, and full viewport image rectangles. The S10 cinematic clears at Vík guesthouse arrival; S12 clears when the cafe scene transitions to the street, so no stale frame or stage characters remain.

## Art review

- Alice, Eric and Damir retain master-reference face anchors, hair, age and canonical travel wardrobe.
- S10 shows Alice and Eric naturally interacting inside the car around the map, stereo and rain-wet petrol station; the emotional focus is not a row of sprites.
- S12 shows Alice and Damir seated at the cafe window with soup, two cups and the sand on Damir’s sleeve; their distance and restrained attention match the authored scene and route-independent opening.
- Independent portrait assets are loaded on mobile. The mobile runtime uses the portrait asset itself without the former blurred continuation; faces, hands and story props remain visible above the dialogue layer.

## Diagnostics

Direct HTTP access returned `200` for `/literary.html`; no `ERR_BLOCKED_BY_CLIENT` occurred. The only repeated browser console 404 is the non-game `/favicon.ico` request; `requestfailed` remained empty. It does not affect game assets or runtime routing.

## Verification

- `npm run literary:compile` — `LITERARY_COMPILE_OK 66 scenes 619 chunks`
- `npm run test:narrative` — passed after final integration
- `git diff --check` — clean
