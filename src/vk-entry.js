import bridge from '@vkontakte/vk-bridge';
import { initVkPlatform } from './platform/vk-games.js';
import { createMockVkBridge } from './platform/vk-bridge-mock.js';
import { startLiteraryPlayer } from './literary-player.js';

const useMock = new URLSearchParams(globalThis.location?.search || '').get('mock') === '1';
const selectedBridge = globalThis.__VK_BRIDGE__ ?? (useMock ? createMockVkBridge() : bridge);
await startLiteraryPlayer({ initPlatform: (options) => initVkPlatform({ ...options, bridge: selectedBridge }) });
