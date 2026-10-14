# Blocker Resolution Matrix — 2026-10-14

Кандидат: `95f094204eeddeb75795e206a2be5cb20693546b`  
Репозиторий: `https://github.com/m-amirov/kiss-at-the-edge-of-the-world`  
Проверка выполняется в отдельном consolidation checkout; публикация в Яндекс Играх не выполняется.

## Источник истины и правила

- Код gate и его фактический результат проверяются в текущем checkout, а не по имени каталога или дате.
- Локальные runtime/smoke результаты не заменяют независимое Web High или внешнее Yandex evidence.
- Приёмка сохраняется только для точного source identity, asset/content hashes и применимого viewport/scope.
- Отсутствующее evidence остаётся `NOT_VERIFIED`, а не преобразуется в `PASS`.

## Матрица

| Блокер | Gate и код, устанавливающий статус | Входные артефакты | Ожидаемая идентичность | Фактическое состояние | Классификация | Минимальное корректное действие | Статус на начало продолжения |
|---|---|---|---|---|---|---|---|
| `STARTER_KIT_DRIFT` | `tools/release/preflight.mjs` → `inspectTargetStatus()`; `tools/starter-kit/status-core.mjs` возвращает `modified`, если hash baseline не равен текущему файлу | `.starter-kit/state.json`, `.starter-kit/target.json`, `.starter-kit/manifest.json`, файлы managed baseline | Starter Kit `0.5.9`, manifest/state schema 2, target profile `new-project`, source manifest hash `cddcfa1ee5d5b2659b6e435bf1442bc13cb856d0d9e4ed255e49c1fadb52e9a0` | До reconciliation: 57 baseline entries отличались по raw bytes. Для большинства содержимое совпадает после LF-нормализации при Windows `core.autocrlf=true`; четыре файла имеют содержательные расхождения, проверенные по diff: changelog (09.10 snapshot + release evidence), `QUALITY_CONSTITUTION` (`.codex/skills`), `self-test` (release hardening), `requirements-audit` (09.10 source date). Product runtime violations/conflicts/second skill root отсутствуют. После явного `--accept-current` на exact HEAD baseline target hashes совпали с фактическими, без замены файлов | Реальный target-state drift, не дефект игровой логики; часть — line-ending drift, часть — намеренные и проверенные project extensions | Сохранить reconciliation record, повторить status/self-test и updater contract suite; будущие обновления Starter Kit проводить через dry-run с review source-vs-current diff | `PASS` после reconciliation |
| `ART_COVERAGE_NOT_ACCEPTED` | `tools/release/preflight.mjs` → `verifyArtAcceptance()`; `tools/release/art-acceptance.mjs` | `artifacts/evidence/production-art-acceptance.json`, coverage matrix, source-bound visual reviews, asset/manifest hashes | Formal record schema 3/4, `status=PASS`, `verdict=PASS_PRODUCTION_ART_66_66`, current product snapshot/HEAD ancestry and asset hashes | Formal record отсутствует в кандидате. Старые S07/S18/S26/S38/S44/S65 материалы сами по себе не имеют доказанной применимости к текущему HEAD `95f0942` | Отсутствующее/неприменимое evidence; дефект продукта не доказан | Переиспользовать только exact-hash evidence; иначе выполнить минимальную source-bound Web High recheck затронутых сцен и сгенерировать record штатным `release:evidence:art`; генерацию изображений не запускать без подтверждённого дефекта | `BLOCKED` |
| `LOCALIZATION_NOT_VERIFIED` | `tools/release/preflight.mjs` → проверка runtime locales в `final-gameplay-videos.json` | `game-spec.yaml` (`ru`, `en`), `artifacts/evidence/final-gameplay-videos.json`, локализованные runtime captures | Для каждого runtime locale должен существовать поддержанный media/evidence record с точной source identity | `final-gameplay-videos.json` отсутствует в кандидате; therefore `ru/en` не подтверждены этим gate. Unit localization tests ранее прошли, но это другой scope | Отсутствующая runtime-проверка, не доказанный дефект перевода | Восстановить/создать только source-bound runtime evidence для RU и EN на текущем HEAD; затем повторить локализационный gate | `BLOCKED` |
| `FINAL_QA_MISSING` | `tools/release/preflight.mjs` → route JSON должен быть `PASS`, иметь текущий HEAD, 12 результатов, expected endings, save/load или no soft-locks, zero errors/failures/layout findings | Один из `artifacts/evidence/final-technical-qa-2026-10-11/routes.json`, `full-route-interaction-final-rc-2026-10-08.json`, `full-route-runtime-qa-2026-09-30.json` | Current HEAD `95f0942`, required route matrix and current runtime evidence | Only `full-route-runtime-qa-2026-09-30.json` present: `PASS`, but HEAD `c299299...` and 8 results, therefore stale/incomplete. Other two candidates отсутствуют | Stale/incomplete evidence; product defect not established | Run the project-native full route browser QA at required desktop/mobile viewports and persist current-HEAD route evidence; do not relabel stale JSON | `BLOCKED` |
| `EXTERNAL_YANDEX_EVIDENCE` | `tools/release/preflight.mjs` unconditionally records missing live Yandex evidence offline; release contract also uses `tools/yandex/release-evidence-gate.mjs` | Published Draft ZIP, live SDK/cloud/ad/moderation/media evidence, external run receipt | Evidence bound to the exact published ZIP/source package and external run | No live Draft/external provider evidence is available offline; local smoke and old ZIP evidence are not equivalent | External release blocker, intentionally not solvable by local source integration | Keep `NOT_VERIFIED`; do not publish to Yandex; source integration may proceed only if source gate explicitly separates this release-only requirement | `BLOCKED` |

## Starter Kit review record

Authoritative upstream for the embedded Starter Kit is the clean `main` checkout at
`E:\Work\YandexGames\starter-kits\yandex-games-autonomous-starter-kit`, HEAD
`8739dbfdbe3512dd16564449004cd84939de1963`, version `0.5.9`. Its working tree is
dirty and therefore its uncommitted files are not used as source. The candidate's
current release-hardening additions remain product-side files; they are not replaced
by the dirty upstream checkout.

The reviewed differences are:

- raw LF/CRLF differences caused by Windows `core.autocrlf=true` for the managed baseline;
- `.starter-kit/docs/CHANGELOG.md`: 9 October documentation revision and aggregated release-evidence note;
- `docs/QUALITY_CONSTITUTION.md`: materialized `.codex/skills` path for this stored new-project profile;
- `tools/starter-kit/self-test.mjs`: release-evidence schema/script checks and reviewed 2026-10-11 registry date;
- `tools/yandex/requirements-audit.mjs`: authoritative 2026-10-09 source date.

No product runtime, game assets, save schema or narrative source is replaced by this
reconciliation. The recovery bundle remains the rollback authority:
`E:\Work\YandexGames\Novells\_kiss-consolidation-recovery-20261014\git-all-refs.bundle`.
