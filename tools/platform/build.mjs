import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PLATFORM_NAMES = new Set(['yandex', 'vk']);

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

export function buildPlatform(root = ROOT, platform, outputDir = path.join(root, 'dist', platform)) {
  if (!PLATFORM_NAMES.has(platform)) throw new Error(`Unsupported platform: ${platform}`);
  const sourceRoot = path.resolve(root);
  const output = path.resolve(outputDir);
  assertSafeOutputPath(sourceRoot, outputDir, platform);
  fs.rmSync(output, { recursive: true, force: true });
  fs.mkdirSync(output, { recursive: true });

  const excludedForYandex = new Set([
    'src/vk-entry.js', 'src/vk-test-entry.js', 'src/platform/vk-games.js', 'src/platform/vk-bridge-mock.js'
  ]);
  const excludedForVk = new Set([
    'src/entry.js', 'src/yandex-entry.js', 'src/yandex-sdk.js', 'src/main.js', 'src/vk-test-entry.js', 'src/platform/vk-bridge-mock.js'
  ]);
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
      if (entry.isSymbolicLink()) throw new Error(`Output contains symlink: ${relative}`);
      if (entry.isDirectory()) visit(file, relative);
      else if (entry.isFile()) files.push(relative);
      else throw new Error(`Unsupported output entry: ${relative}`);
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
