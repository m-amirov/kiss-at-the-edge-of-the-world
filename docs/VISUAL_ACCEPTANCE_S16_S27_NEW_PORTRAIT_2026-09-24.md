# Ограниченная новая постановка S16 и S27 — 2026-09-24

## Scope

Отдельная bounded-задача после завершённого и остановленного repair loop. Затронуты только два portrait-ассета:

- `S16`, authored event `s16-guesthouse-help`, `[0,1]`;
- `S27`, authored event `s27-egilsstadir-boardwalk`, `[0,0]`.

Desktop-ассеты, сценарий, cues, размеры текстовой панели, общий fullscreen UI, S28 и S49 не изменялись.

## Source preflight

- S16 exact authored text: туристка подворачивает ногу; Дамир представляется врачом, получает согласие и осматривает лодыжку двумя руками; действие не должно превращаться в разговор или групповую позу.
- S27 exact authored text: Инга организует замену двух досок; работа включает доску, рабочие руки, крепления и инструмент; это не общая сцена наблюдения.
- Master references checked: `assets/characters/alice-master.png`, `damir-master.png`, `nick-master.png`, `eric-master.png`.

## New assets

| Event | Asset | Dimensions | SHA-256 | Local pixel inspection |
|---|---|---:|---|---|
| S16 | `assets/cg/s16-guesthouse-help-portrait.png` | 941x1672 | `EB509012CF1430472CDDC54C1026A2BD00E2B8A2C9204D06996071A2FB0C0686` | hands, ankle and Damir central/above sheet |
| S27 | `assets/cg/s27-egilsstadir-boardwalk-portrait.png` | 941x1672 | `E94B308E3BD380C183377CE6723B39B1A46EDFD5F8FBDA412F7C33108F4DB461` | drill, screw, replacement board and hands above sheet |

## Runtime captures

Chrome current-runtime capture completed with 15 PNG and zero page/request errors:

- S16 event: `output/playwright/fullscreen-regression-2026-09-24/S16-s16-guesthouse-help-1920x900.png`, `...-390x844.png`, `...-360x640.png`;
- S27 event: `output/playwright/fullscreen-regression-2026-09-24/S27-s27-egilsstadir-boardwalk-1920x900.png`, `...-390x844.png`, `...-360x640.png`;
- the same run also captured S16 pre-cue and regression targets S28/S49 at all three viewports.

## Independent acceptance gate

The retry used two small `ceos_bulk_checker_web` batches with `local_image`. Actual pixels were confirmed for all four PNGs.

Attempt IDs and supplied images:

- S16 attempt `01a0d43a-3dd5-7882-98a1-f113ecf2c5a3`: `S16-s16-guesthouse-help-360x640.png`, `S16-s16-guesthouse-help-390x844.png`.
- S27 attempt `01a0d43a-3ea5-7870-bcab-02ec1abc82e9`: `S27-s27-egilsstadir-boardwalk-360x640.png`, `S27-s27-egilsstadir-boardwalk-390x844.png`.

`actualPixelsSupplied: true` applies only to these confirmed batches.

Results:

- S16 / 360x640: **FAIL**. Both Damir hands are visible, but the injured ankle is partly covered by the open text panel; the tourist is mostly cropped. Text remains readable.
- S16 / 390x844: **PASS**. Damir's hands and the injured ankle are clearly above the panel; roles and text are readable.
- S27 / 360x640: **PASS**. Drill, working gloved hands, replacement board and fastener make boardwalk repair unambiguous above the panel; text is readable.
- S27 / 390x844: **PASS**. Same criteria pass with more room above the panel.

## Bounded S16 mobile repair attempt

Only `assets/cg/s16-guesthouse-help-portrait.png` was replaced. S27, CSS, literary UI, text panel, scenario and S16 cue `[0,1]` were unchanged. New SHA-256: `50F5353FFACF349DCF7C13709AC654A03B9EB7112AF16924E9F1E6FBA7193550`.

Fresh current-runtime capture completed with 15 PNG and zero page/request errors. The relevant fresh PNGs are:

- `output/playwright/fullscreen-regression-2026-09-24/S16-s16-guesthouse-help-360x640.png`
- `output/playwright/fullscreen-regression-2026-09-24/S16-s16-guesthouse-help-390x844.png`
- `output/playwright/fullscreen-regression-2026-09-24/S27-s27-egilsstadir-boardwalk-360x640.png`
- `output/playwright/fullscreen-regression-2026-09-24/S27-s27-egilsstadir-boardwalk-390x844.png`

Independent Web attempt: `01a0d43f-dde8-7252-acfd-b75f91f1443f`.

Transport failure: `stream disconnected before completion: ChatGPT composer rejected the plain-text editing command`.

The failure occurred before image handoff. `actualPixelsSupplied: false`; no S16 verdict was received. Existing confirmed results remain recorded: S27/360 PASS, S27/390 PASS, S16/390 PASS. The new S16/360 result is unconfirmed.

Overall: `VISUAL_ACCEPTANCE: BLOCKED`. No further generation, CSS change, final regression PASS claim, project-test PASS claim, or publication/push was performed.

## S16/360 independent review retry

Attempt ID: `01a0d44a-552c-7872-9db7-45b7ae9bd3c1`.

Image requested for handoff: `output/playwright/fullscreen-regression-2026-09-24/S16-s16-guesthouse-help-360x640.png`.

Transport error: `stream disconnected before completion: ChatGPT did not confirm that the prompt was sent. Check the ChatGPT tab before continuing.`

The reviewer did not confirm receipt. `actualPixelsSupplied: false`; no independent S16/360 verdict exists. No generation, CSS change, regression, project tests, or push was performed.

## Final S16/360 acceptance

Short control request trace: `01a0d463-6194-7b21-9c3b-8d0c7b4b6fa7`.

Independent result: **PASS**. Reviewer confirmed that the injured ankle, including the foot and injury area, and both of Damir's hands are fully visible above the lower text block and are not cropped or covered by text.

Verified S16 portrait SHA-256: `50F5353FFACF349DCF7C13709AC654A03B9EB7112AF16924E9F1E6FBA7193550`.

Final runtime regression capture: S16, S27, S28 and S49 at `1920x900`, `390x844`, and `360x640`; 15 captures, zero page/request errors. `npm run test:narrative` passed. Starter-kit self-test must be rerun after the evidence/product commit because it fail-closes on a modified target tree.
