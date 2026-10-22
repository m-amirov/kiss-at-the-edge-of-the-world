// Production Yandex entry: the approved literary edition is the only player
// exposed by the release shell. The platform SDK is selected by this entry,
// never by the shared literary engine.
import { initYandexPlatform } from './yandex-sdk.js';

const app = document.getElementById('app');
if (app) app.id = 'literary-app';
const { startLiteraryPlayer } = await import('./literary-player.js');
await startLiteraryPlayer({ initPlatform: initYandexPlatform });
