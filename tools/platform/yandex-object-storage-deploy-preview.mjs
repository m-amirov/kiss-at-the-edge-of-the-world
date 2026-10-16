import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  MIME_BY_EXTENSION,
  auditLocalBundle,
  getGitHead
} from './vk-hosting-audit.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CONFIG_FILE = path.join(ROOT, 'config/platform/yandex-object-storage-preview.json');
const BUCKET_NAME_PATTERN = /^(?=.{3,63}$)[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const PROFILE_PATTERN = /^[A-Za-z0-9_.-]+$/;
const FOLDER_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const PRODUCTION_WORD_PATTERN = /(?:^|[-_])(prod|production|release|main)(?:$|[-_])/i;

export const YC_COMMAND = 'yc';
export const OBJECT_STORAGE_ENDPOINT = 'https://storage.yandexcloud.net';
export const WEBSITE_HOST_SUFFIX = '.website.yandexcloud.net';
export const OBJECT_HOST_SUFFIX = '.storage.yandexcloud.net';

export function assertPreviewDeployConfig(config) {
  if (config?.schemaVersion !== 1 || config.provider !== 'yandex-object-storage' || config.environment !== 'preview') {
    throw new Error('Yandex Object Storage deploy requires the preview yandex-object-storage profile');
  }
  if (config.productionDeploy !== false) throw new Error('Yandex Object Storage production deploy is disabled by contract');
  if (config.outputDir !== 'dist/vk' || config.entry !== 'index.html' || config.errorPage !== 'index.html') {
    throw new Error('Yandex preview must target the complete dist/vk bundle with index.html entry and fallback');
  }
  if (config.requireBucketWithoutDots !== true || config.requireHttps !== true) {
    throw new Error('Yandex preview requires a dot-free bucket and HTTPS');
  }
  if (config.requirePublicReadObjects !== true || config.forbidPublicWrite !== true) {
    throw new Error('Yandex preview must require object read and forbid public write');
  }
  if (config.forbidPublicListByDefault !== true) {
    throw new Error('Yandex static website listing must remain disabled by default');
  }
  for (const name of ['bucketEnv', 'folderIdEnv', 'profileEnv']) {
    if (!/^[A-Z][A-Z0-9_]+$/.test(config[name] || '')) throw new Error(`invalid Yandex environment variable name: ${name}`);
  }
  return config;
}

export function assertBucketName(value) {
  if (typeof value !== 'string' || !BUCKET_NAME_PATTERN.test(value) || value.includes('.') || PRODUCTION_WORD_PATTERN.test(value)) {
    throw new Error('Yandex preview bucket must be a 3-63 character lowercase dot-free non-production name');
  }
  if (/^\d+(?:\.\d+){3}$/.test(value)) throw new Error('Yandex bucket must not look like an IP address');
  return value;
}

export function assertProfileName(value) {
  if (!PROFILE_PATTERN.test(value)) throw new Error('YC_PROFILE contains unsafe characters');
  return value;
}

export function assertFolderId(value) {
  if (!FOLDER_ID_PATTERN.test(value)) throw new Error('YC_VK_PREVIEW_FOLDER_ID contains unsafe characters');
  return value;
}

export function buildObjectUrl(bucket) {
  assertBucketName(bucket);
  return `https://${bucket}${OBJECT_HOST_SUFFIX}/index.html`;
}

export function buildWebsiteUrl(bucket) {
  assertBucketName(bucket);
  return `https://${bucket}${WEBSITE_HOST_SUFFIX}/`;
}

export function buildWebsiteSettings() {
  return { index: 'index.html', error: 'index.html' };
}

export function buildProfileArgs(config, env) {
  const args = [];
  const profile = env[config.profileEnv];
  const folderId = env[config.folderIdEnv];
  if (profile) args.push('--profile', assertProfileName(profile));
  if (folderId) args.push('--folder-id', assertFolderId(folderId));
  return args;
}

function assertSha(value, label) {
  if (!/^[a-f0-9]{40}$/.test(value)) throw new Error(`${label} is not a full commit SHA`);
}

export function buildBucketCreateArgs(config, { bucket, env = {} }) {
  assertPreviewDeployConfig(config);
  assertBucketName(bucket);
  return ['storage', 'bucket', 'create', '--name', bucket, ...buildProfileArgs(config, env)];
}

export function buildPublicReadOnlyArgs(config, { bucket, env = {} }) {
  assertPreviewDeployConfig(config);
  assertBucketName(bucket);
  return ['storage', 'bucket', 'update', '--name', bucket, '--public-read', ...buildProfileArgs(config, env)];
}

export function buildWebsiteSettingsArgs(config, { bucket, env = {} }) {
  assertPreviewDeployConfig(config);
  assertBucketName(bucket);
  return [
    'storage', 'bucket', 'update', '--name', bucket,
    '--website-settings', JSON.stringify(buildWebsiteSettings()),
    ...buildProfileArgs(config, env)
  ];
}

export function buildObjectUploadArgs(config, { bucket, file, env = {} }) {
  assertPreviewDeployConfig(config);
  assertBucketName(bucket);
  if (!file || typeof file.path !== 'string' || !path.isAbsolute(file.absolute)) throw new Error('upload plan requires an absolute local file');
  const extension = path.posix.extname(file.path).toLowerCase();
  const contentType = MIME_BY_EXTENSION[extension] ?? 'application/octet-stream';
  return [
    'storage', 's3api', 'put-object',
    // yc storage s3api --body treats an unprefixed value as literal data.
    // Prefix the absolute filename with @ to upload the file bytes.
    '--body', `@${file.absolute}`,
    '--bucket', bucket,
    '--key', file.path,
    '--content-type', contentType,
    ...buildProfileArgs(config, env)
  ];
}

export function buildDeploymentPlan(config, { root, bucket, env = {}, sourceHead, bundleSha256, mode = 'object' }) {
  assertPreviewDeployConfig(config);
  assertBucketName(bucket);
  assertSha(sourceHead, 'source HEAD');
  if (!/^[a-f0-9]{64}$/.test(bundleSha256)) throw new Error('bundle SHA-256 is not valid');
  if (!['object', 'website'].includes(mode)) throw new Error('Yandex preview mode must be object or website');
  const bundleRoot = path.resolve(root, config.outputDir);
  const localFiles = fs.readdirSync(bundleRoot, { recursive: true })
    .filter((entry) => typeof entry === 'string')
    .map((entry) => entry.replaceAll(path.sep, '/'))
    .filter((entry) => fs.statSync(path.join(bundleRoot, ...entry.split('/'))).isFile())
    .sort();
  const local = { files: localFiles.map((relative) => ({
    path: relative,
    absolute: path.join(bundleRoot, ...relative.split('/'))
  })) };
  const upload = local.files.map((file) => buildObjectUploadArgs(config, { bucket, file, env }));
  const base = {
    sourceHead,
    bundleSha256,
    bucket,
    mode,
    objectUrl: buildObjectUrl(bucket),
    websiteUrl: buildWebsiteUrl(bucket),
    fileCount: upload.length,
    upload,
    createBucket: buildBucketCreateArgs(config, { bucket, env }),
    publicReadOnly: buildPublicReadOnlyArgs(config, { bucket, env }),
    websiteSettings: buildWebsiteSettingsArgs(config, { bucket, env })
  };
  return base;
}

function readConfig() {
  const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  return assertPreviewDeployConfig(config);
}

function requireEnv(env, name) {
  const value = env[name];
  if (!value) throw new Error(`BLOCKED_YANDEX_OBJECT_STORAGE_CONFIG: set ${name} outside Git`);
  return value;
}

function parseMode(argv) {
  const index = argv.indexOf('--mode');
  const value = index >= 0 ? argv[index + 1] : undefined;
  return value && !value.startsWith('--') ? value : 'object';
}

function runYc(args, { root, env, spawnImpl }) {
  return new Promise((resolve, reject) => {
    const child = spawnImpl(YC_COMMAND, args, {
      cwd: root,
      env: { ...env },
      shell: false,
      stdio: 'inherit'
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`Yandex Object Storage command failed: code=${code ?? 'null'} signal=${signal ?? 'null'}`));
    });
  });
}

function assertYcAvailable() {
  const result = spawnSync(YC_COMMAND, ['--version'], { stdio: 'ignore', windowsHide: true });
  if (result.error?.code === 'ENOENT' || result.status === null) throw new Error('BLOCKED_YC_CLI_MISSING: install and authenticate the official Yandex Cloud CLI');
  if (result.status !== 0) throw new Error('BLOCKED_YC_CLI_UNAVAILABLE: yc --version failed');
}

export async function runPreviewDeploy({ root = ROOT, env = process.env, argv = process.argv, spawnImpl = spawn } = {}) {
  const config = readConfig();
  const local = auditLocalBundle(root);
  if (local.status !== 'PASS') throw new Error(`BLOCKED_VK_BUNDLE_AUDIT: ${local.errors.join('; ')}`);
  const mode = parseMode(argv);
  const planBucket = env[config.bucketEnv] ?? 'vk-games-preview-example';
  const plan = buildDeploymentPlan(config, {
    root,
    bucket: planBucket,
    env,
    sourceHead: getGitHead(path.resolve(root)),
    bundleSha256: local.bundleSha256,
    mode
  });
  if (argv.includes('--plan')) {
    return {
      status: 'PLAN_ONLY',
      sourceHead: plan.sourceHead,
      bundleSha256: plan.bundleSha256,
      fileCount: plan.fileCount,
      audioFiles: local.audioFiles,
      mode,
      objectUrl: plan.objectUrl,
      websiteUrl: plan.websiteUrl,
      requiredEnvironment: [config.bucketEnv, config.folderIdEnv, config.profileEnv],
      staticWebsiteBlocker: 'Yandex static website hosting requires public object listing; object mode keeps listing disabled',
      commandSummary: {
        createBucket: plan.createBucket,
        publicReadOnly: plan.publicReadOnly,
        websiteSettings: plan.websiteSettings,
        uploadCount: plan.upload.length,
        uploadExample: plan.upload.slice(0, 2)
      }
    };
  }
  if (!argv.includes('--confirm-preview')) throw new Error('BLOCKED_YANDEX_PREVIEW_CONFIRMATION: pass --confirm-preview for a manual dev deploy');
  if (!argv.includes('--owner-authorized')) throw new Error('BLOCKED_YANDEX_OWNER_AUTHORIZATION: owner authorization is required before cloud mutation');
  if (!argv.includes('--allow-public-read')) throw new Error('BLOCKED_YANDEX_PUBLIC_READ_CONFIRMATION: pass --allow-public-read only after owner approval');
  if (mode === 'website' && !argv.includes('--allow-public-list')) {
    throw new Error('BLOCKED_YANDEX_WEBSITE_REQUIRES_PUBLIC_LIST: official static website hosting requires public object listing; use object mode or obtain explicit owner approval');
  }
  if (!argv.includes('--upload')) throw new Error('BLOCKED_YANDEX_UPLOAD_CONFIRMATION: pass --upload for object writes');
  const bucket = assertBucketName(requireEnv(env, config.bucketEnv));
  assertYcAvailable();
  const effectivePlan = buildDeploymentPlan(config, {
    root,
    bucket,
    env,
    sourceHead: plan.sourceHead,
    bundleSha256: plan.bundleSha256,
    mode
  });
  if (argv.includes('--create-bucket')) await runYc(buildBucketCreateArgs(config, { bucket, env }), { root, env, spawnImpl });
  // Keep a newly created bucket private until every object is uploaded.
  // If an upload fails, do not widen anonymous access.
  for (const args of effectivePlan.upload) await runYc(args, { root, env, spawnImpl });
  await runYc(buildPublicReadOnlyArgs(config, { bucket, env }), { root, env, spawnImpl });
  if (mode === 'website') {
    await runYc(['storage', 'bucket', 'update', '--name', bucket, '--public-list', ...buildProfileArgs(config, env)], { root, env, spawnImpl });
    await runYc(buildWebsiteSettingsArgs(config, { bucket, env }), { root, env, spawnImpl });
  }
  return {
    status: 'DEPLOYED_PREVIEW',
    sourceHead: effectivePlan.sourceHead,
    bundleSha256: effectivePlan.bundleSha256,
    fileCount: effectivePlan.fileCount,
    audioFiles: local.audioFiles,
    mode,
    url: mode === 'website' ? effectivePlan.websiteUrl : effectivePlan.objectUrl,
    publicListing: mode === 'website'
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await runPreviewDeploy();
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
