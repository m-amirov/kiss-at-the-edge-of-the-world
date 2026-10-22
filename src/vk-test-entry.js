import { createMockVkBridge } from './platform/vk-bridge-mock.js';
import { initVkPlatform } from './platform/vk-games.js';
import { startLiteraryPlayer } from './literary-player.js';

document.documentElement.dataset.platform = 'vk';
const bridge = createMockVkBridge();
await startLiteraryPlayer({
  initPlatform: (options) => initVkPlatform({ ...options, bridge })
});
