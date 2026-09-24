# S27 visual acceptance — 2026-09-24

## Причина остановки предыдущего задания

Предыдущий проход остановился до browser-evidence gate: Playwright/Chrome не
был выполнен, поэтому отсутствовали свежие runtime screenshots и machine
evidence. Это была evidence-блокировка, а не ошибка authored routing или
отсутствие файлов S27.

## Authored routing

- Scene: `S27`
- Event: `s27-egilsstadir-boardwalk`
- Source address: `[0,0]`
- Presentation: `cinematic`
- Desktop: `assets/cg/s27-egilsstadir-boardwalk.png`
- Mobile: `assets/cg/s27-egilsstadir-boardwalk-portrait.png`
- Stage sprites: `0`

## Browser evidence

Runner: `tools/visual-qa/s22-s26-runtime.mjs`, адаптированный только для S27.

Machine evidence: `output/playwright/s27-runtime-2026-09-24/evidence.json`

Screenshots:

- `output/playwright/s27-runtime-2026-09-24/S27-s27-egilsstadir-boardwalk-1920x900.png`
- `output/playwright/s27-runtime-2026-09-24/S27-s27-egilsstadir-boardwalk-390x844.png`
- `output/playwright/s27-runtime-2026-09-24/S27-s27-egilsstadir-boardwalk-360x640.png`

| Viewport | Actual asset | Natural size | Overflow | Text visible | Inner scroll | Buttons | JS/request errors |
|---|---|---:|---|---|---|---|---:|
| 1920×900 | desktop | 1672×941 | none | yes | no | enabled/in viewport | 0 |
| 390×844 | portrait | 941×1672 | none | yes | no | enabled/in viewport | 0 |
| 360×640 | portrait | 941×1672 | none | yes | no | enabled/in viewport | 0 |

## Verdict

`VISUAL_ACCEPTANCE: PASS`

Runtime routing and layout checks pass. The portrait asset was recomposed only
for S27 so the wet boardwalk, working hands, hammer and nails box remain clearly
visible above the open text panel at both mobile viewports. The desktop asset,
script, authored event and literary UI were not changed.

Last successful operation: the isolated runner captured all 3 viewports with
zero JS/request errors, zero overflow, zero stage sprites and the expected
desktop/portrait assets; visual inspection confirmed the repair action is
visible above the text panel at 390×844 and 360×640.

Unfinished checks: none for the bounded S27 scope. Full four-route traversal and
save/load remain a separate `PARTIAL` task.
