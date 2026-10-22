import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditLocalBundle } from '../../tools/platform/vk-hosting-audit.mjs';
import {
  assertBucketName,
  assertPreviewDeployConfig,
  buildBucketCreateArgs,
  buildDeploymentPlan,
  buildObjectUrl,
  buildPublicReadOnlyArgs,
  buildWebsiteSettingsArgs,
  buildWebsiteUrl
} from '../../tools/platform/yandex-object-storage-deploy-preview.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('Yandex preview profile is HTTPS, dot-free, read-only by default and non-production', () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'config/platform/yandex-object-storage-preview.json'), 'utf8'));
  assert.doesNotThrow(() => assertPreviewDeployConfig(config));
  assert.equal(config.productionDeploy, false);
  assert.equal(config.forbidPublicListByDefault, true);
  assert.equal(config.forbidPublicWrite, true);
  assert.throws(() => assertPreviewDeployConfig({ ...config, productionDeploy: true }), /production/);
  assert.throws(() => assertPreviewDeployConfig({ ...config, forbidPublicListByDefault: false }), /listing/);
});

test('Yandex preview bucket and URLs reject TLS-hostile names', () => {
  assert.equal(assertBucketName('vk-games-preview-20261016'), 'vk-games-preview-20261016');
  assert.throws(() => assertBucketName('vk.games.preview'), /dot-free/);
  assert.throws(() => assertBucketName('vk-games-prod'), /dot-free/);
  assert.throws(() => assertBucketName('../escape'), /dot-free/);
  assert.equal(buildObjectUrl('vk-games-preview-20261016'), 'https://vk-games-preview-20261016.storage.yandexcloud.net/index.html');
  assert.equal(buildWebsiteUrl('vk-games-preview-20261016'), 'https://vk-games-preview-20261016.website.yandexcloud.net/');
});

test('Yandex upload plan covers the exact bundle, all eight OGG files and explicit MIME', () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'config/platform/yandex-object-storage-preview.json'), 'utf8'));
  const local = auditLocalBundle(root);
  assert.equal(local.status, 'PASS', local.errors.join('; '));
  const plan = buildDeploymentPlan(config, {
    root,
    bucket: 'vk-games-preview-20261016',
    sourceHead: local.sourceHead,
    bundleSha256: local.bundleSha256,
    env: {}
  });
  assert.equal(plan.fileCount, local.fileCount);
  assert.equal(plan.upload.length, local.fileCount);
  assert.equal(local.audioFiles.length, 8);
  const uploadText = JSON.stringify(plan.upload);
  for (const audio of local.audioFiles) assert.match(uploadText, new RegExp(audio.replaceAll('.', '\\.'), 'u'));
  assert.match(uploadText, /--content-type.*audio\/ogg/);
  assert.match(uploadText, /--content-type.*image\/png/);
  assert.match(uploadText, /--content-type.*text\/javascript/);
  assert.match(uploadText, /--content-type.*text\/css/);
  assert.match(uploadText, /--content-type.*application\/json/);
  assert.doesNotMatch(uploadText, /public-read-write|--public-list/);
});

test('Yandex upload passes real file bytes to yc instead of a literal path', () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'config/platform/yandex-object-storage-preview.json'), 'utf8'));
  const local = auditLocalBundle(root);
  assert.equal(local.status, 'PASS', local.errors.join('; '));
  const plan = buildDeploymentPlan(config, {
    root,
    bucket: 'vk-games-preview-20261016',
    sourceHead: local.sourceHead,
    bundleSha256: local.bundleSha256
  });
  for (const args of plan.upload) {
    const bodyIndex = args.indexOf('--body');
    const keyIndex = args.indexOf('--key');
    assert.ok(bodyIndex >= 0 && keyIndex >= 0);
    const body = args[bodyIndex + 1];
    assert.ok(body.startsWith('@'), 'yc --body must prefix an existing file with @');
    const uploadedFile = body.slice(1);
    assert.ok(path.isAbsolute(uploadedFile));
    const key = args[keyIndex + 1];
    assert.deepEqual(
      fs.readFileSync(uploadedFile),
      fs.readFileSync(path.join(root, 'dist', 'vk', ...key.split('/'))),
      `upload body must match bundled bytes for ${key}`
    );
  }
  assert.equal(plan.upload.filter(args => args[args.indexOf('--key') + 1].endsWith('.ogg')).length, 8);
});

test('Yandex mutation commands never enable public write or listing in object mode', () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'config/platform/yandex-object-storage-preview.json'), 'utf8'));
  const create = buildBucketCreateArgs(config, { bucket: 'vk-games-preview-20261016', env: {} });
  const readOnly = buildPublicReadOnlyArgs(config, { bucket: 'vk-games-preview-20261016', env: {} });
  const website = buildWebsiteSettingsArgs(config, { bucket: 'vk-games-preview-20261016', env: {} });
  assert.deepEqual(create.slice(0, 5), ['storage', 'bucket', 'create', '--name', 'vk-games-preview-20261016']);
  assert.ok(readOnly.includes('--public-read'));
  assert.ok(!readOnly.includes('--public-list'));
  assert.ok(!readOnly.includes('public-read-write'));
  assert.ok(website.includes('--website-settings'));
  assert.ok(website.includes(JSON.stringify({ index: 'index.html', error: 'index.html' })));
});
