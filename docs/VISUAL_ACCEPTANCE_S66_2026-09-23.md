# S66 visual acceptance — 2026-09-23

Статус партии S66: **PASS для native Windows Chromium runtime; PARTIAL для
полной browser/platform приёмки**.

## Runtime evidence

Проверен текущий `main` на commit `3720ba5` через существующий локальный
`tools/dev-server.mjs` и установленный Windows Playwright Chromium из
`E:\Work\YandexGames\heart-of-the-grove\node_modules\playwright`.

| Viewport | Presentation | Visual event | Loaded asset | Natural size | Overflow | Errors |
|---|---|---|---|---:|---|---|
| 1920×900 | background | scene-start | `s66-hveragerdi-greenhouse.png` | 1832×859 | none | 0 |
| 390×844 | background | scene-start | `s66-hveragerdi-greenhouse-portrait.png` | 941×1672 | none | 0 |
| 360×640 | background | scene-start | `s66-hveragerdi-greenhouse-portrait.png` | 941×1672 | none | 0 |

The runtime reported location `Теплица Hveragerði: грядки и кафе`, time
`день 4, день`, and the desktop mapping remained
`s66-hveragerdi-greenhouse.png` on both mobile viewports. The mobile reader
panel is internally scrollable for the long authored text; its footer and
`Далее` control remain inside the viewport.

Screenshots:

- `output/playwright/s66-2026-09-23/desktop.png`
- `output/playwright/s66-2026-09-23/mobile.png`
- `output/playwright/s66-2026-09-23/mobile-small.png`
- machine-readable result: `output/playwright/s66-2026-09-23/runtime-evidence.json`

## Artistic review

The desktop and portrait images depict the same authored geothermal greenhouse
setting: glass structure, volcanic gravel, planted beds, warm lamps, cafe
corner and Icelandic mountain beyond fogged glass. Both are empty environment
plates; visible people in runtime are the existing stage actors, not embedded
in the background. No readable text, logos, watermarks, black bars, blurred
side fill or malformed environmental artifact was observed.

## Chromium investigation

The earlier `HCS_E_HYPERV_NOT_INSTALLED` result came from the host's previous
Playwright CLI path, not from a project requirement. This repository has no
Playwright dependency or configured test script; `npm ls @playwright/test
playwright` is empty. Native Windows Playwright is nevertheless usable when
invoked from an existing installed Playwright package and its Windows browser
binary. No WSL2, Hyper-V or virtualization setting was installed or changed.

The result is not equivalent to Yandex Draft, authenticated SDK, cloud saves or
cross-browser acceptance, so the overall release/art gate remains `PARTIAL`.
