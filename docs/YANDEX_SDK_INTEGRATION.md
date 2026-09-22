# Интеграция Yandex Games SDK

Runtime подключает SDK динамически только в окружении Yandex Games через относительный `/sdk.js` и сохраняет локальный режим для разработки на `127.0.0.1`. Реализованы:

- `YaGames.init()`;
- `LoadingAPI.ready()` после готовности интерфейса;
- `GameplayAPI.start()` после инициализации;
- обработчики `game_api_pause` / `game_api_resume` и browser visibility fallback;
- загрузка и запись состояния через `ysdk.getPlayer()`, `player.getData()` и `player.setData()`;
- считывание `ysdk.environment.i18n.lang` с fallback `ru`;
- полноэкранная реклама только при добровольном переходе к новому прохождению после финала, с `onClose`/`onError`;
- fail-closed local fallback: недоступность SDK или cloud storage не блокирует прохождение.

Источники актуального API:

- https://yandex.ru/dev/games/doc/ru/sdk/sdk-about
- https://yandex.ru/dev/games/doc/ru/sdk/sdk-game-events
- https://yandex.ru/dev/games/doc/ru/sdk/sdk-player
- https://yandex.ru/dev/games/doc/ru/sdk/sdk-adv

Локальная проверка подтверждает local fallback и отсутствие блокирующей зависимости от SDK. Проверка в авторизованном Yandex Draft runtime требует внешнего App ID и отдельного запуска provider evidence; она не выполнялась автоматически.
