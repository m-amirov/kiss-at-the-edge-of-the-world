import bridge from '@vkontakte/vk-bridge';
import { initVkPlatform } from './platform/vk-games.js';
import { startLiteraryPlayer } from './literary-player.js';
import { vkAudioBaseUrl } from './vk-audio-config.js';

document.documentElement.dataset.platform = 'vk';
await startLiteraryPlayer({
  initPlatform: (options) => initVkPlatform({ ...options, bridge }),
  audioBaseUrl: vkAudioBaseUrl
});
