# Visual acceptance — S17–S21 and S61

Дата: 2026-09-24. Партия: `PARTIAL`.

Добавлены десять локальных изображений: пять desktop 1672×941 и пять независимых portrait 941×1672. Authored mapping использует события `[0,0]`: `s17-hofn-guesthouse`, `s19-hofn-pool`, `s20-hofn-damir-kitchen`, `s21-alice-hofn-room` и environment `s61-hofn-streets`. S18 оставлен без изменений и продолжает использовать принятые прогулку/танец.

`npm run literary:compile`, `npm run test:narrative` и `git diff --check` — PASS.

Browser acceptance is not complete. The in-app browser failed focus emulation; native Windows Chrome/Playwright launched but the full interactive loop stalled after the first click. Therefore the four route completions, save/load restoration, three viewport screenshots, overflow, control availability and runtime image readback remain `NOT_VERIFIED`. Evidence: `artifacts/evidence/browser-regression-2026-09-24.json`.

Общий сезонный PASS не присваивается.
