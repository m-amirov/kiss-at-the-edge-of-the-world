import { createMockVkBridge } from './platform/vk-bridge-mock.js';
import { initVkPlatform } from './platform/vk-games.js';
import { startLiteraryPlayer } from './literary-player.js';

const bridge = createMockVkBridge();
await startLiteraryPlayer({
  initPlatform: (options) => initVkPlatform({ ...options, bridge })
});
