# S18 REWORK report — 2026-10-10

## Verdict

`REWORK` preserved and stopped at the requested boundary. The product repair is committed locally, targeted runtime QA passes, two Web High roles pass, and the independent Art Director still returns `REWORK` for portrait360. No remaining Batch 1 scenes, Batch 2, full-season acceptance, merge, or publication were run.

## Exact cause and source check

The first Reasoner finding was `S18-P360-COMPOSITION` on `codex-input-image-6`:

> На экране 360×640 текстовый блок начинается непосредственно под лицами Алисы и Эрика и перекрывает значительную часть их торсов. Из-за этого персонажи визуально обрываются на уровне груди, а большая часть нижней композиции скрывается текстом. Верхняя часть экрана при этом занята преимущественно небом и горами. Лица, маяк, текст и навигация видны, однако вертикальное распределение пространства неудачное. Требуется корректировка композиции именно для короткого мобильного viewport.

The real pre-repair PNG confirmed the finding: dialogue-sheet top was approximately y=272 while the character images continued to approximately y=546. The source cue is `S18:hofn-lighthouse`, scene `S18. Маяк. Эрик и неотправленная открытка`, with the authored Alice/Eric paragraph beginning `За домами ветер был слабее...`. The adjacent 390×844 and 1920×900 source-bound frames did not reproduce the same immediate cutoff.

## Bounded repair

Product commit: `2901605e000445776891467740994e15bf63299c`.

- Added cue-owned `stageComposition` `s18-hofn-lighthouse-short-mobile` only to `S18:hofn-lighthouse`.
- Added a `max-width:680px` + `max-height:700px` CSS rule that raises/reduces only this cue's Alice/Eric stage above the dialogue sheet.
- Added a route-stability test for the cue, cast and `s18-hofn-harbour.webp` mapping.
- No narrative, assets, route/save state, or neighboring scene mapping changed.

## Targeted runtime QA

Fresh runtime evidence is source-bound to product HEAD `2901605e000445776891467740994e15bf63299c`, with target and neighboring frames captured at all three viewports (9 PNG total). All images were ready; no console errors, 404s, viewport overflow, or internal reader scroll were observed.

| viewport | target cue/layout | sheet top | lowest actor bottom | result |
|---|---|---:|---:|---|
| 1920×900 | `hofn-lighthouse` / `s18-hofn-lighthouse-short-mobile` (desktop generic CSS) | 613.9 | 684.0 | PASS |
| 390×844 | `hofn-lighthouse` / same cue-owned mapping (390 rules unchanged) | 501.0 | 700.5 | PASS |
| 360×640 | `hofn-lighthouse` / short-mobile override | 271.5 | 454.1 | PASS runtime; visual re-review remains REWORK |

Runtime evidence: `artifacts/evidence/s18-rework-2026-10-10/runtime/evidence.json` and its 9 PNGs.

## Three independent Web High roles

Each role received the same three current PNGs, with 3/3 observations, selected model `chatgpt-web/gpt-6-sol`, reasoning `high`, host user/assistant identities, trace, and attachment SHA/bytes recorded in its raw receipt. The bridge receipt is host-observed; `providerAttested=false` and provider task/response/review IDs remain null and were not synthesized.

| role | trace | verdict | result |
|---|---|---|---|
| `ceos_reasoner_web` | `055e04584f33` | PASS | 3/3 observations; no critical crop/overlap/readability defect; minor mobile composition notes |
| `ceos_bulk_checker_web` | `210a7ea72f84` | PASS | 3/3 observations; no blocking visual defect |
| `ceos_art_director_web` | `32bf2cea4607` | REWORK | desktop PASS, portrait390 PASS, portrait360 REWORK |

Art Director's exact remaining finding for portrait360:

> При уменьшении высоты viewport до 640 px персонажи располагаются существенно ближе к текстовой области. Первая строка повествования пересекает нижние части их силуэтов. Возникает визуальная конкуренция между персонажами и текстом, особенно в области одежды. При этом лица остаются видимыми, текст полностью читается, маяк присутствует в кадре, а элементы навигации не обрезаны.

It also requested a fresh portrait360 screenshot after correction and confirmation that 390×844 and desktop are not degraded. Those observations are preserved; per instruction, no further Web turn or second repair attempt is started.

Raw receipts and complete responses:

- `artifacts/evidence/web-high-s18-rework/reasoner-20261010.json.receipt.json` / `.json`
- `artifacts/evidence/web-high-s18-rework/bulk-20261010.json.receipt.json` / `.json`
- `artifacts/evidence/web-high-s18-rework/art-director-20261010.json.receipt.json` / `.json`

## Checks and Git

- Source tests: `34/34 PASS` (`s18-preview`, `literary-visual`, `literary-stage` and their dependencies in the targeted command).
- Web preflight: 3/3 `READY_BROWSER_TURN_PREFLIGHT`, 3 attachments each, 2,575,803 bytes per turn, exact refs/dimensions/SHA-256/bytes.
- Current repair worktree HEAD: `2901605e000445776891467740994e15bf63299c` before evidence commit.
- Feature branch target: `feature/host-observed-art-acceptance-v1`.
- Evidence files are limited to the S18 rework report, source-bound runtime evidence, new plan and three raw/complete Web turn pairs; no credentials, browser profiles or secrets are included.
