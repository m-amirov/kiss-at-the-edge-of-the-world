# Диагностика CEOS и Starter Kit — 2026-09-20

## Итог

- CEOS: `PASS`, версия `0.5.1`, установлен из официального репозитория `m-amirov/codex-engineering-system`, commit `bb10b45ed755fa01153c2139974c0f9c37c415e0`.
- `romance-narrative`: доступен рабочему окружению Codex; `ceos context --skill romance-narrative --project .` завершается `0`.
- Глобальные агенты и hybrid-routing: зарегистрированы; `ceos global-status`, `ceos doctor`, `ceos status`, `ceos capabilities` проходят.
- Требуется новый Codex-сеанс: штатный installer upstream явно требует перезапуска после глобальной установки.
- Starter Kit self-test: `FAIL/BLOCKED`, первопричина — несовпадение свежего проектного Yandex-документального baseline со старым Starter Kit manifest baseline.

## CEOS-восстановление

Проверки:

```text
ceos --version                         -> 0.5.1
ceos global-status                     -> PASS
ceos doctor --project .                -> PASS
ceos context --skill romance-narrative -> PASS
ceos status --project .                -> profile yandex-games, read-only
ceos capabilities --project .         -> native agents present, Web READY
ceos web-preflight                     -> READY
```

Официальный upstream 0.5.1 содержит файл `skills/romance-narrative/SKILL.md`, но на проверенном commit не включал его в `SKILL_NAMES` и `SKILL_POLICY_MAP`. Поэтому исходная установка имела файл в дистрибутиве, но рабочий CLI отвечал `Unknown skill`. Зарегистрированы только эти подтверждённые пропуски; параллельный skill-root не создавался. Глобальный manifest теперь содержит `romance-narrative`.

Это отдельный upstream-gap CEOS 0.5.1, а не дефект проекта игры. После выхода следующего официального upstream-релиза локальную коррекцию нужно заменить штатным обновлением.

## Фактическая маршрутизация аудита

| Роль | Agent ID | Задача | Результат |
|---|---|---|---|
| `ceos_explorer` | `01a0bd6f-8cfe-7ba0-a630-31c0996e6339` | Карта эпизодов, runtime-графа, script/runtime divergences | Подтверждены мёртвые state-поля, географический откат Дамира, расхождение `careerThesis`, длительность |
| `ceos_bulk_checker` | `01a0bd6f-8e84-7312-893e-d0a6a8d652f9` | Детерминированные объёмы и длительность без сложения взаимоисключающих ветвей | 4 326 runtime-слов; 14,7–16,3 мин на прохождение; таблица по 12 эпизодам и маршрутам |
| native fallback reviewer | `01a0bd6f-ed90-7712-9e82-21948ae34050` | Независимый review романтики и earned intimacy | 5 подтверждённых дефектов, 2 редакторских риска; файлы не изменены |
| native fallback verifier | `01a0bd6f-ee08-7b71-b4a1-fa0b57e9d73a` | Проверка выборов, порогов, достижимости финалов и Алисы | FAIL: все 4 финала достижимы, но route prerequisites/repairDebt/state tests не доказаны |
| `ceos_reviewer` | `01a0bd6f-8d88-7961-a5ae-97b43edcb932` | Тот же review в штатной модели `gpt-5.6` | Не запущен: модель не поддерживается текущим ChatGPT-хостом; выполнен ровно один native fallback |
| `ceos_verifier` | `01a0bd6f-8e08-7033-8c9d-22ff0ee01dbe` | Тот же verification в штатной модели `gpt-5.6` | Не запущен: модель не поддерживается текущим ChatGPT-хостом; выполнен ровно один native fallback |
| `ceos_reasoner_web` | `01a0bd74-df05-70b0-b081-be407f636712` | Синтез bounded evidence bundle | Transport error `net::ERR_ABORTED`; Web не использован как доказательство |
| `ceos_bulk_checker_web` | `01a0bd74-fe01-7ab3-8dc2-59f9795e63f6` | Классификация bounded evidence bundle | Transport error `net::ERR_ABORTED`; Web не использован как доказательство |

`web_preflight_status=READY`, `web_agents_used=[]`, `native_fallback_used=true`, `fallback_reason=штатные native review/verifier модели недоступны; Web transport оборвался`. Native evidence и финальная координация выполнены в текущей сессии; никаких последовательных действий одного агента за многоагентную работу не выдаётся.

## Starter Kit self-test

Наблюдение:

```text
npm run starter-kit:self-test -> target status is modified
```

`npm run starter-kit:status` сообщает:

- версия source/updater/installed/target: `0.5.7`;
- `modifiedManagedFiles` ровно два:
  - `config/yandex-doc-snapshot.json`;
  - `tools/yandex/requirements-audit.mjs`;
- остальные managed-файлы, semantic-merge-файлы и ownership violations не изменены;
- `unresolvedConflicts=[]`, `pendingMigrations=[]`, `forbiddenSecondRootStatus=clean`.

Сравнение с `E:\Work\YandexGames\starter-kits\yandex-games-autonomous-starter-kit` показывает:

1. `config/yandex-doc-snapshot.json` — свежий снимок требований, fetched/reviewed `2026-09-19`; в нём отражены изменения официальной страницы, включая repealed `1.6.1.3`, `1.6.2.3`, `2.6`, `2.10` и обновлённое правило `2.9`.
2. `tools/yandex/requirements-audit.mjs` добавляет эти же идентификаторы в `EXPECTED_REPEALED_IDS`.
3. Текущий Starter Kit manifest/state всё ещё содержит старые SHA-256; поэтому self-test классифицирует актуализацию документального baseline как managed drift.

Классификация:

| Категория | Результат |
|---|---|
| Официальное Starter Kit изменение | Базовая версия `0.5.7` и её manifest не обновлены под свежий Yandex snapshot |
| Проектное изменение | Свежий Yandex snapshot и синхронный parser expectation в двух указанных файлах |
| Случайная модификация | Не подтверждена |
| Устаревшее требование платформы | Старые записи baseline до актуализации 19.09.2026 |
| Ошибка проверки | Self-test не различает авторизованную документальную актуализацию и случайный drift |

Файлы не откатывались, хеши не подменялись, self-test не отключался. Исправление требует upstream Starter Kit: обновить manifest/baseline или штатно оформить документальную миграцию. До такого обновления инфраструктурный verdict остаётся `BLOCKED`, но он не препятствует чтению и аудиту сценария.
