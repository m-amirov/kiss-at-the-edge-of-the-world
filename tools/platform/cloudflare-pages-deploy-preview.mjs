import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { auditLocalBundle, getGitHead } from './vk-hosting-audit.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CONFIG_FILE = path.join(ROOT, 'config/platform/vk-external-hosting.json');

export const DEPLOY_PACKAGE = 'wrangler@4.151.0';

export function assertPreviewDeployConfig(config) {
  if (config?.schemaVersion !== 1 || config.provider !== 'cloudflare-pages' || config.environment !== 'preview') {
    throw new Error('Cloudflare deploy requires the preview cloudflare-pages profile');
  }
  if (config.productionDeploy !== false) throw new Error('production deploy is disabled by contract');
  if (config.outputDir !== 'dist/vk' || config.entry !== 'index.html' || config.requireHttps !== true) {
    throw new Error('Cloudflare deploy config must target the built VK bundle over HTTPS');
  }
  if (!config.branch || config.branch === 'main' || config.branch === 'production') {
    throw new Error('Cloudflare preview branch must not be a production branch');
  }
  for (const name of ['projectNameEnv', 'accountIdEnv', 'apiTokenEnv']) {
    if (!/^[A-Z][A-Z0-9_]+$/.test(config[name] || '')) throw new Error(`invalid Cloudflare environment variable name: ${name}`);
  }
}

function readConfig() {
  const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  assertPreviewDeployConfig(config);
  return config;
}

function requireEnv(env, name) {
  const value = env[name];
  if (!value) throw new Error(`BLOCKED_CLOUDFLARE_AUTH: set ${name} outside Git`);
  return value;
}

function assertProjectName(value) {
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(value)) throw new Error('CF Pages project name contains unsafe characters');
  return value;
}

export function buildDeployArgs(config, { projectName, sourceHead }) {
  assertPreviewDeployConfig(config);
  assertProjectName(projectName);
  if (!/^[a-f0-9]{40}$/.test(sourceHead)) throw new Error('source HEAD is not a full commit SHA');
  return [
    '--yes', `wrangler@${config.wranglerVersion}`, 'pages', 'deploy', config.outputDir,
    '--project-name', projectName,
    '--branch', config.branch,
    '--commit-hash', sourceHead,
    '--commit-message', `VK dev preview ${sourceHead}`
  ];
}

export async function runPreviewDeploy({ root = ROOT, env = process.env, spawnImpl = spawn } = {}) {
  const config = readConfig();
  const local = auditLocalBundle(root);
  if (local.status !== 'PASS') throw new Error(`BLOCKED_VK_BUNDLE_AUDIT: ${local.errors.join('; ')}`);
  const projectName = assertProjectName(requireEnv(env, config.projectNameEnv));
  requireEnv(env, config.accountIdEnv);
  requireEnv(env, config.apiTokenEnv);
  const sourceHead = getGitHead(path.resolve(root));
  const args = buildDeployArgs(config, { projectName, sourceHead });
  const child = spawnImpl('npx', args, {
    cwd: root,
    env: { ...env },
    shell: process.platform === 'win32',
    stdio: 'inherit'
  });
  return await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve({ status: 'DEPLOYED_PREVIEW', sourceHead, bundleSha256: local.bundleSha256, projectName, branch: config.branch });
      else reject(new Error(`Cloudflare preview deploy failed: code=${code ?? 'null'} signal=${signal ?? 'null'}`));
    });
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv.includes('--confirm-preview')) {
    console.error('BLOCKED_CLOUDFLARE_PREVIEW_CONFIRMATION: pass --confirm-preview for a manual dev deploy');
    process.exitCode = 2;
  } else {
    try {
      const result = await runPreviewDeploy();
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error(error.message);
      process.exitCode = 2;
    }
  }
}
