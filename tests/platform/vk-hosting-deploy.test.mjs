import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertDevDeployConfig, childEnvironment, DEPLOY_PACKAGE } from '../../tools/platform/vk-deploy-dev.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('VK hosting config targets the real authorized app and dev endpoints only', () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'vk-hosting-config.json'), 'utf8'));
  assert.equal(config.app_id, 54782569);
  assert.equal(config.static_path, 'dist/vk');
  assert.deepEqual(config.endpoints, { web: 'index.html', mobile: 'index.html', mvk: 'index.html' });
  assert.doesNotThrow(() => assertDevDeployConfig(config));
});

test('dev launcher requires explicit confirmation and forces dev environment', () => {
  assert.equal(DEPLOY_PACKAGE, '@vkontakte/vk-miniapps-deploy@1.0.3');
  assert.throws(() => assertDevDeployConfig({
    static_path: 'dist/vk',
    app_id: 54782569,
    endpoints: { web: 'index.html', mobile: 'index.html', mvk: 'index.html' },
    noprompt: true,
    update_prod: true,
    update_dev: true
  }), /production-update disabled/);
  assert.equal(childEnvironment({ MINI_APPS_ENVIRONMENT: 'production' }).MINI_APPS_ENVIRONMENT, 'dev');
  assert.equal(childEnvironment({}).CI_URLS, 'true');
});
