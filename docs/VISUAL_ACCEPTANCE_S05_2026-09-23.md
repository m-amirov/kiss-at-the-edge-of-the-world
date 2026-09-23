# S05 visual acceptance — 2026-09-23

Статус: **PASS для native Windows Chromium runtime; PARTIAL для полной
platform/browser приёмки**.

| Viewport | Visual event | Loaded asset | Natural size | Overflow | Errors |
|---|---|---|---:|---|---|
| 1920×900 | `scene-start` | `s05-hveragerdi-road.png` | 1832×859 | none | 0 |
| 390×844 | `scene-start` | `s05-hveragerdi-road-portrait.png` | 941×1672 | none | 0 |
| 360×640 | `scene-start` | `s05-hveragerdi-road-portrait.png` | 941×1672 | none | 0 |

Runtime location/time: `Гостевой дом и дорога к Hveragerði`, `день 3, утро`.
Portrait is an independent road composition, not a crop or blurred extension.
Both versions contain only the environment; stage characters remain runtime
assets. No text, logos, watermarks, black bars or visible generation artifacts
were found.

Screenshots:

- `output/playwright/s05-2026-09-23/desktop.png`
- `output/playwright/s05-2026-09-23/mobile.png`
- `output/playwright/s05-2026-09-23/mobile-small.png`
- `output/playwright/s05-2026-09-23/runtime-evidence.json`
