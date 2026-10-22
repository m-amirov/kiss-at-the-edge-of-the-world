import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { collectRuntimeAssets } from './runtime-assets.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PLATFORM_NAMES = new Set(['yandex', 'vk']);

export function validateExternalAudioBaseUrl(value) {
  if (typeof value !== 'string' || !value || !value.endsWith('/')) throw new Error('VK_AUDIO_BASE_URL must be an HTTPS directory URL ending in /');
  let url;
  try { url = new URL(value); } catch { throw new Error('VK_AUDIO_BASE_URL is invalid'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.origin === 'null') {
    throw new Error('VK_AUDIO_BASE_URL must be HTTPS without credentials, query or fragment');
  }
  return url.toString();
}



function isWithin(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}

function hasTraversal(value) {
  return String(value).split(/[\\/]+/).includes('..');
}

function canonicalPath(candidate) {
  let current = candidate;
  const suffix = [];
  while (!fs.existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) return path.resolve(candidate);
    suffix.unshift(path.basename(current));
    current = parent;
  }
  return path.resolve(fs.realpathSync(current), ...suffix);
}

function assertNoSymlinkComponents(candidate) {
  const parsed = path.parse(candidate);
  let current = parsed.root;
  for (const part of candidate.slice(parsed.root.length).split(path.sep)) {
    if (!part) continue;
    current = path.join(current, part);
    // lstat also detects dangling symlinks (existsSync returns false for those).
    if (fs.lstatSync(current, { throwIfNoEntry: false })?.isSymbolicLink()) {
      throw new Error('Unsafe output path: symlink');
    }
  }
}

export function assertSafeOutputPath(root, outputDir, platform) {
  if (!PLATFORM_NAMES.has(platform)) throw new Error('Unsafe output path: unknown platform');
  if (typeof outputDir !== 'string' || !outputDir || outputDir.includes('\0')) {
    throw new Error('Unsafe output path');
  }
  if (hasTraversal(outputDir)) throw new Error('Unsafe output path: traversal');

  const sourceRoot = fs.realpathSync(path.resolve(root));
  const requested = path.resolve(outputDir);
  assertNoSymlinkComponents(requested);
  const canonical = canonicalPath(requested);

  // Only the dedicated output tree for the selected platform may be replaced.
  // Never allow an external directory, the shared dist/ root or another
  // platform's output, even when --out is supplied explicitly.
  const allowedRoot = path.join(sourceRoot, 'dist', platform);
  if (!isWithin(allowedRoot, canonical)) {
    throw new Error('Unsafe output path: outside platform build directory');
  }
  return { requested, canonical, sourceRoot };
}

function copyTree(source, target, sourceRoot, filter = () => true) {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    const relative = path.relative(sourceRoot, sourcePath).split(path.sep).join('/');
    if (!filter(relative, entry)) continue;
    if (entry.isSymbolicLink()) throw new Error(`Source symlink is not allowed: ${relative}`);
    if (entry.isDirectory()) copyTree(sourcePath, targetPath, sourceRoot, filter);
    else if (entry.isFile()) fs.copyFileSync(sourcePath, targetPath);
    else throw new Error(`Unsupported source entry: ${relative}`);
  }
}

function copySelectedAssets(sourceRoot, output, selection) {
  for (const relative of selection.files) {
    const sourcePath = path.join(sourceRoot, ...relative.split('/'));
    const targetPath = path.join(output, ...relative.split('/'));
    const stat = fs.lstatSync(sourcePath);
    if (stat.isSymbolicLink()) throw new Error(`Source symlink is not allowed: ${relative}`);
    if (!stat.isFile()) throw new Error(`Runtime asset is not a regular file: ${relative}`);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
  }
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function sourceHead(root) {
  try {
    return execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

export function buildPlatform(root = ROOT, platform, outputDir = path.join(root, 'dist', platform), options = {}) {
  if (!PLATFORM_NAMES.has(platform)) throw new Error(`Unsupported platform: ${platform}`);
  const sourceRoot = path.resolve(root);
  const output = path.resolve(outputDir);
  assertSafeOutputPath(sourceRoot, outputDir, platform);
  if (options.externalAudioBaseUrl && platform !== 'vk') throw new Error('External audio build is VK-only');
  const externalAudioBaseUrl = options.externalAudioBaseUrl ? validateExternalAudioBaseUrl(options.externalAudioBaseUrl) : null;
  const assetSelection = collectRuntimeAssets(sourceRoot, platform);
  const externalAudioFiles = externalAudioBaseUrl
    ? assetSelection.files.filter((file) => /^assets\/audio\/music\/[^/]+\.ogg$/i.test(file))
    : [];
  if (externalAudioBaseUrl && externalAudioFiles.length !== 8) throw new Error('VK Hosting requires all eight declared OGG cues');
  const packagedSelection = externalAudioBaseUrl ? {
    ...assetSelection,
    files: assetSelection.files.filter((file) => !externalAudioFiles.includes(file)),
    entries: assetSelection.entries.filter((entry) => !externalAudioFiles.includes(entry.path))
  } : assetSelection;
  const externalAudio = externalAudioBaseUrl ? {
    baseUrl: externalAudioBaseUrl,
    files: externalAudioFiles.map((file) => ({
      path: file, sha256: sha256(path.join(sourceRoot, ...file.split('/')))
    }))
  } : null;
  fs.rmSync(output, { recursive: true, force: true });
  fs.mkdirSync(output, { recursive: true });

  const excludedForYandex = new Set([
    'src/vk-entry.js', 'src/vk-test-entry.js', 'src/platform/vk-games.js', 'src/platform/vk-bridge-mock.js'
  ]);
  const excludedForVk = new Set([
    'src/entry.js', 'src/yandex-entry.js', 'src/yandex-sdk.js', 'src/main.js', 'src/vk-test-entry.js', 'src/platform/vk-bridge-mock.js'
  ]);
  const excluded = platform === 'yandex' ? excludedForYandex : excludedForVk;
  copySelectedAssets(sourceRoot, output, packagedSelection);
  const runtimeSourceFiles = new Set(assetSelection.sourceFiles);
  copyTree(path.join(sourceRoot, 'src'), path.join(output, 'src'), sourceRoot,
    (relative, entry) => entry.isDirectory() || (runtimeSourceFiles.has(relative) && !excluded.has(relative)));
  fs.copyFileSync(path.join(sourceRoot, platform === 'vk' ? 'vk.html' : 'index.html'), path.join(output, 'index.html'));
  if (platform === 'yandex' && fs.existsSync(path.join(sourceRoot, 'literary.html'))) {
    fs.copyFileSync(path.join(sourceRoot, 'literary.html'), path.join(output, 'literary.html'));
  }

  if (platform === 'vk') {
    if (externalAudioBaseUrl) fs.writeFileSync(path.join(output, 'src', 'vk-audio-config.js'), `export const vkAudioBaseUrl = ${JSON.stringify(externalAudioBaseUrl)};\n`);
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
      if (entry.isSymbolicLink()) throw new Error(`Output contains symlink: ${relative}`);
      if (entry.isDirectory()) visit(file, relative);
      else if (entry.isFile()) files.push(relative);
      else throw new Error(`Unsupported output entry: ${relative}`);
    }
  };
  visit(output);
  const manifest = {
    schemaVersion: 2,
    platform,
    sourceHead: sourceHead(sourceRoot),
    entry: 'index.html',
    assetSelection: packagedSelection,
    ...(externalAudio ? { externalAudio } : {}),
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
    const externalAudio = process.argv.includes('--external-audio');
    const externalAudioBaseUrl = externalAudio ? process.env.VK_AUDIO_BASE_URL : null;
    if (externalAudio && !externalAudioBaseUrl) throw new Error('VK Hosting build requires VK_AUDIO_BASE_URL');
    console.log(JSON.stringify(buildPlatform(ROOT, platform, output, { externalAudioBaseUrl }), null, 2));
  } catch (error) {
    console.error(`BLOCKED_PLATFORM_BUILD: ${error.message}`);
    process.exitCode = 2;
  }
}
