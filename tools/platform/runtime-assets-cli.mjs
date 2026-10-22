import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectRuntimeAssets } from './runtime-assets.mjs';

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const root = path.resolve(argument('--root') ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const platform = argument('--platform');
if (!platform) {
  console.error('Usage: node runtime-assets-cli.mjs --root <project> --platform <yandex|vk>');
  process.exitCode = 2;
} else {
  try {
    console.log(JSON.stringify(collectRuntimeAssets(root, platform)));
  } catch (error) {
    console.error(`BLOCKED_RUNTIME_ASSET_SELECTION: ${error.message}`);
    process.exitCode = 2;
  }
}
