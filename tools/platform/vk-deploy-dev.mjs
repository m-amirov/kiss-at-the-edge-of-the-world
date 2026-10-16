import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CONFIG_FILE = path.join(ROOT, 'vk-hosting-config.json');
export const DEPLOY_PACKAGE = '@vkontakte/vk-miniapps-deploy@1.0.3';

export function assertDevDeployConfig(config) {
  if (!config || config.static_path !== 'dist/vk' || !Number.isInteger(config.app_id) || config.app_id < 1) {
    throw new Error('VK dev deploy requires vk-hosting-config.json with a valid app_id and static_path=dist/vk');
  }
  if (config.endpoints?.web !== 'index.html' || config.endpoints?.mobile !== 'index.html' || config.endpoints?.mvk !== 'index.html') {
    throw new Error('VK dev deploy requires web, mobile and mvk endpoints to point to index.html');
  }
  if (config.noprompt !== true || config.update_prod !== false || config.update_dev !== true) {
    throw new Error('VK dev deploy must be non-interactive, dev-only and production-update disabled');
  }
  if (!fs.existsSync(path.join(ROOT, config.static_path, 'index.html'))) {
    throw new Error('VK dev deploy requires a built dist/vk/index.html; run npm run build:vk first');
  }
  return config;
}

export function childEnvironment(env = process.env) {
  return { ...env, MINI_APPS_ENVIRONMENT: 'dev', CI_URLS: 'true' };
}

export async function runDevDeploy({ argv = process.argv, env = process.env } = {}) {
  if (!argv.includes('--confirm-dev')) {
    throw new Error('Refusing VK hosting deploy without explicit --confirm-dev');
  }
  const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  assertDevDeployConfig(config);
  // npm exposes npx as a .cmd shim on Windows. Node cannot spawn that shim
  // directly in the desktop runner (EINVAL), while shell resolution is safe
  // here because every argument is fixed by this launcher.
  const executable = 'npx';
  await new Promise((resolve, reject) => {
    const child = spawn(executable, ['--yes', DEPLOY_PACKAGE], {
      cwd: ROOT,
      env: childEnvironment(env),
      stdio: 'inherit',
      shell: process.platform === 'win32'
    });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (signal) reject(new Error(`VK dev deploy terminated by ${signal}`));
      else if (code === 0) resolve();
      else reject(new Error(`VK dev deploy exited with code ${code}`));
    });
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runDevDeploy().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
