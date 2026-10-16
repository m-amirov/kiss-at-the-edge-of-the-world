// Production Yandex entry: the approved ten-episode literary edition is the
// only player exposed by the release shell. Legacy/preview runtimes remain
// developer artifacts and are not selectable through production URL params.
import { initYandexPlatform } from './yandex-sdk.js';

const app = document.getElementById('app');
if (app) app.id = 'literary-app';
const { startLiteraryPlayer } = await import('./literary-player.js');
await startLiteraryPlayer({ initPlatform: initYandexPlatform });
