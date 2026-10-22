import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditLocalBundle, auditRemoteBundle, MIME_BY_EXTENSION, validateRemoteUrl } from '../../tools/platform/vk-hosting-audit.mjs';
import { assertPreviewDeployConfig, buildDeployArgs, DEPLOY_PACKAGE } from '../../tools/platform/cloudflare-pages-deploy-preview.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('VK HTTPS hosting audit validates the exact current bundle and preserves audio', () => {
  const result = auditLocalBundle(root);
  assert.equal(result.status, 'PASS', result.errors.join('; '));
  assert.match(result.sourceHead, /^[a-f0-9]{40}$/);
  assert.match(result.bundleSha256, /^[a-f0-9]{64}$/);
  assert.ok(result.audioFiles.length > 0);
  assert.ok(result.files.some((file) => file.path === 'vendor/vk-bridge.js' && file.mime === 'text/javascript'));
  assert.ok(result.files.some((file) => file.path.endsWith('.ogg') && file.mime === 'audio/ogg'));
});

test('hosting MIME contract covers all served asset classes', () => {
  assert.equal(MIME_BY_EXTENSION['.js'], 'text/javascript');
  assert.equal(MIME_BY_EXTENSION['.css'], 'text/css');
  assert.equal(MIME_BY_EXTENSION['.ogg'], 'audio/ogg');
  assert.equal(MIME_BY_EXTENSION['.png'], 'image/png');
  assert.equal(MIME_BY_EXTENSION['.webp'], 'image/webp');
  assert.equal(MIME_BY_EXTENSION['.ttf'], 'font/ttf');
});

test('remote hosting must be HTTPS and credential-free', () => {
  assert.equal(validateRemoteUrl('https://preview.example.test/game/').toString(), 'https://preview.example.test/game/');
  assert.throws(() => validateRemoteUrl('http://preview.example.test/'), /HTTPS/);
  assert.throws(() => validateRemoteUrl('https://user:pass@preview.example.test/'), /credentials/);
});

test('remote audit checks every manifest resource MIME and rejects iframe blockers', async () => {
  const bundle = auditLocalBundle(root);
  const index = fs.readFileSync(path.join(root, 'dist/vk/index.html'), 'utf8');
  const fetchImpl = async (url) => {
    const pathname = new URL(url).pathname;
    const relative = pathname.slice(pathname.indexOf('/index.html') === -1 ? 1 : pathname.lastIndexOf('/') + 1);
    const contentType = relative === 'index.html'
      ? 'text/html; charset=utf-8'
      : bundle.files.find((file) => file.path === relative)?.mime ?? 'application/octet-stream';
    return new Response(relative === 'index.html' ? index : null, {
      status: 200,
      headers: { 'content-type': contentType }
    });
  };
  const pass = await auditRemoteBundle(root, 'https://preview.example.test/', { fetchImpl });
  assert.equal(pass.status, 'PASS', pass.errors.join('; '));
  assert.equal(pass.checkedCount, bundle.fileCount);
  assert.equal(pass.iframeCompatible, true);

  const blockedFetch = async (url, options) => {
    const response = await fetchImpl(url, options);
    if (new URL(url).pathname.endsWith('/index.html') && options.method === 'GET') {
      response.headers.set('x-frame-options', 'DENY');
    }
    return response;
  };
  const blocked = await auditRemoteBundle(root, 'https://preview.example.test/', { fetchImpl: blockedFetch });
  assert.equal(blocked.status, 'FAIL');
  assert.match(blocked.errors.join('; '), /X-Frame-Options/);
});

test('Cloudflare deployment contract is preview-only and carries exact HEAD', () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'config/platform/vk-external-hosting.json'), 'utf8'));
  assert.equal(DEPLOY_PACKAGE, 'wrangler@4.151.0');
  assert.doesNotThrow(() => assertPreviewDeployConfig(config));
  assert.throws(() => assertPreviewDeployConfig({ ...config, productionDeploy: true }), /production/);
  assert.throws(() => assertPreviewDeployConfig({ ...config, branch: 'main' }), /production branch/);
  const args = buildDeployArgs(config, { projectName: 'kiss-at-the-edge-preview', sourceHead: 'a'.repeat(40) });
  assert.deepEqual(args.slice(0, 6), ['--yes', 'wrangler@4.151.0', 'pages', 'deploy', 'dist/vk', '--project-name']);
  assert.ok(args.includes('--branch'));
  assert.ok(!args.includes('--env') && !args.includes('production'));
});
