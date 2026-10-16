import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PLATFORM_NAMES = new Set(['yandex', 'vk']);

function copyTree(source, target, sourceRoot, filter = () => true) {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    const relative = path.relative(sourceRoot, sourcePath).split(path.sep).join('/');
    if (!filter(relative, entry)) continue;
    if (entry.isDirectory()) copyTree(sourcePath, targetPath, sourceRoot, filter);
    else if (entry.isFile()) fs.copyFileSync(sourcePath, targetPath);
  }
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function sourceHead(root) {
  try {
    return execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

export function buildPlatform(root = ROOT, platform, outputDir = path.join(root, 'dist', platform)) {
  if (!PLATFORM_NAMES.has(platform)) throw new Error(`Unsupported platform: ${platform}`);
  const sourceRoot = path.resolve(root);
  const output = path.resolve(outputDir);
  fs.rmSync(output, { recursive: true, force: true });
  fs.mkdirSync(output, { recursive: true });

  const excludedForYandex = new Set(['src/vk-entry.js', 'src/platform/vk-games.js', 'src/platform/vk-bridge-mock.js']);
  const excludedForVk = new Set(['src/entry.js', 'src/yandex-entry.js', 'src/yandex-sdk.js']);
  const excluded = platform === 'yandex' ? excludedForYandex : excludedForVk;
  copyTree(path.join(sourceRoot, 'assets'), path.join(output, 'assets'), sourceRoot);
  copyTree(path.join(sourceRoot, 'src'), path.join(output, 'src'), sourceRoot,
    (relative, entry) => entry.isDirectory() || !excluded.has(relative));
  fs.copyFileSync(path.join(sourceRoot, platform === 'vk' ? 'vk.html' : 'index.html'), path.join(output, 'index.html'));
  if (platform === 'yandex' && fs.existsSync(path.join(sourceRoot, 'literary.html'))) {
    fs.copyFileSync(path.join(sourceRoot, 'literary.html'), path.join(output, 'literary.html'));
  }

  if (platform === 'vk') {
    const bridgeSource = path.join(sourceRoot, 'node_modules', '@vkontakte', 'vk-bridge', 'dist', 'index.es.js');
    if (!fs.existsSync(bridgeSource)) throw new Error('VK Bridge dependency is not installed');
    const vendorDir = path.join(output, 'vendor');
    fs.mkdirSync(vendorDir, { recursive: true });
    fs.copyFileSync(bridgeSource, path.join(vendorDir, 'vk-bridge.js'));
    const htmlFile = path.join(output, 'index.html');
    const html = fs.readFileSync(htmlFile, 'utf8').replace(
      '"/node_modules/@vkontakte/vk-bridge/dist/index.es.js"',
      '"./vendor/vk-bridge.js"'
    );
    fs.writeFileSync(htmlFile, html);
  }

  const files = [];
  const visit = (directory, prefix = '') => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      const file = path.join(directory, entry.name);
      const relative = path.posix.join(prefix, entry.name);
      if (entry.isDirectory()) visit(file, relative);
      else if (entry.isFile()) files.push(relative);
    }
  };
  visit(output);
  const manifest = {
    schemaVersion: 1,
    platform,
    sourceHead: sourceHead(sourceRoot),
    entry: 'index.html',
    files: files.map((relative) => ({ path: relative, sha256: sha256(path.join(output, relative)) }))
  };
  fs.writeFileSync(path.join(output, 'build-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return { platform, outputDir: output, sourceHead: manifest.sourceHead, files: [...files, 'build-manifest.json'] };
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const platform = argument('--platform');
  const output = argument('--out') ?? path.join(ROOT, 'dist', platform ?? 'unknown');
  try {
    console.log(JSON.stringify(buildPlatform(ROOT, platform, output), null, 2));
  } catch (error) {
    console.error(`BLOCKED_PLATFORM_BUILD: ${error.message}`);
    process.exitCode = 2;
  }
}
