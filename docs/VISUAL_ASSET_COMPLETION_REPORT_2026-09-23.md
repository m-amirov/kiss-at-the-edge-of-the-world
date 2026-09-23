# Visual asset completion report — 2026-09-23

## Итог

Статус: **PARTIAL**. Route-specific month-later CG для S44–S47 созданы, сохранены, внесены в manifest и подключены к явным visual events. Полное покрытие всех 61 позиций из аудита этим проходом не достигнуто: для ряда локаций всё ещё нет авторского ассета, поэтому runtime корректно оставляет нейтральный stage вместо ложной иллюстрации.

Последняя партия пользовательских изображений заменяет эти четыре файла: S44 — встреча у выхода из вокзала, S45 — ремонт лампы, S46 — обмен выпечкой в кафе, S47 — тосты на кухне. Финальный экран теперь удерживает CG последнего эпилога после последнего нажатия «Далее».

## Интеграционная проверка текущей партии

- Источники доступны локально в `C:\Users\user\Downloads` и скопированы в действующие runtime paths.
- `npm run literary:compile` — PASS (`66 scenes`, `619 chunks`).
- `npm run test:narrative` — PASS, включая удержание terminal CG, сброс при новой сцене и изоляцию маршрутов.
- Provenance SHA-256 — PASS; ledger обновлён под фактически интегрированные PNG.
- `npm run starter-kit:self-test` — PASS.
- `npm run lint` — BLOCKED: в `package.json` отсутствует script `lint`.
- `npm run build` — BLOCKED: в `package.json` отсутствует script `build`.
- Browser QA 1920×900 и 390×844 — BLOCKED: Playwright CLI не запускается на host из-за отсутствующего WSL2/Hyper-V (`HCS_E_HYPERV_NOT_INSTALLED`). Поэтому актуальные runtime screenshots не созданы.

Итоговый статус этой партии: **PARTIAL** до доступности browser QA и отсутствующих lint/build scripts.

## Создано

- `assets/cg/s44-eric-epilogue-month-later.png` — домашний/городской эпилог Эрика.
- `assets/cg/s45-nick-home-epilogue-month-later.png` — домашний эпилог Ника с монтажом.
- `assets/cg/s46-damir-epilogue-month-later.png` — поздняя встреча Дамира у аэропортового автобуса.
- `assets/cg/s47-alice-home-epilogue-month-later.png` — независимый домашний эпилог Алисы.

Все четыре композиции сделаны с безопасным центральным действием для узкого viewport; отдельные `-mobile` файлы не потребовались.

## Переиспользовано и подключено

- `s18-hofn-harbour.png` назначен стартовым фоном S17 и S18.
- `reykjavik-harbour-master.png` назначен стартовым фоном S43 и S44.
- S44–S47 month-later events теперь используют отдельные CG и не остаются на stage-персонажах в походной одежде.
- Маршрутизация осталась address/event-driven: scene id, visual event, route/choice state и time jump; keyword matching не возвращён.

## Проверки

- `node --test tests/narrative/literary-visual.test.mjs` — PASS (6/6), включая S02, S13, S18 и финальные visual beats.
- `npm run literary:compile` — PASS (`66 scenes`, `619 chunks`).
- Полный `npm run test:narrative` ранее дошёл до visual suite и выявил только устаревшее ожидание теста; после его корректировки targeted visual suite проходит. Полный npm barrier после последней правки не перезапускался.
- SHA-256 и provenance новых файлов сохранены в `assets/provenance/rights-manifest.json`.

## Что осталось


## Follow-up: очистка текста на CG и mobile S46 — 2026-09-23

- На четырёх финальных CG удалены обнаруженные случайные/неуместные надписи и текстовые артефакты локальной правкой изображения; композиция, персонажи и routing не менялись.
- Обновлены SHA-256 в `assets/provenance/rights-manifest.json`: S44 `D1987EAD5DAC9FD26C74694C8D64DADF73C6A79066C8C1C829F426CBF520A03B`, S45 `0A95116942E8046EE71BD6D008FAA0FCF3E2EA34B8E792F8B388B79C0F0A8734`, S46 `4FF183BADAC5D980DA2565086C4E5BE520CFB8BD824B19BB825BC1648960CE0E`, S47 `2642735A952673F22A43F373B67A03296F265624C27A6926E7EF64D06B0AEA1D`.
- Для длинных страниц текст теперь находится во внутреннем прокручиваемом `.reader-content`, а `.reader-footer` с кнопкой «Далее» остаётся закреплённым внутри карточки; текст и размер шрифта не сокращались.
- Добавлен регрессионный тест мобильной компоновки в `tests/narrative/literary-reader.test.mjs`.
- Браузерные скриншоты этого follow-up не созданы: Playwright на текущем Windows host заблокирован отсутствующим WSL2/Hyper-V (`HCS_E_HYPERV_NOT_INSTALLED`). Статус follow-up: **PARTIAL**, не PASS.
