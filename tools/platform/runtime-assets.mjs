import fs from 'node:fs';
import path from 'node:path';

const TEXT_EXTENSIONS = new Set(['.css', '.html', '.js', '.json', '.mjs']);
const RUNTIME_MANIFEST_FAMILIES = new Set(['font', 'music']);
const EXTERNAL_RUNTIME_PATHS = new Set(['/sdk.js']);
const HTML_DEPENDENCY_RE = /(?:src|href)\s*=\s*["']([^"']+)["']/gi;
const JS_IMPORT_RE = /(?:import\s*\(\s*|(?:import|export)\s+(?:[^'";]*?\sfrom\s*)?)["']([^"']+)["']/g;
const ASSET_STRING_RE = /["'`]((?:\/?|\.\.?\/)assets\/[^"'`?#}\s\\]+)["'`]/g;
const CSS_URL_RE = /url\(\s*["']?([^"')]+)["']?\s*\)/gi;

function posixRelative(value) {
  return value.replaceAll('\\', '/').replace(/^\.\//, '');
}

function isAssetPath(value) {
  return value === 'assets' || value.startsWith('assets/');
}

function isExternalReference(value) {
  return !value || value.startsWith(('#', 'data:', 'http://', 'https://', '//', 'mailto:', 'javascript:'));
}

function normalizeAssetReference(sourceRelative, rawReference) {
  const raw = String(rawReference ?? '').trim().split(/[?#]/, 1)[0].replaceAll('\\', '/');
  if (isExternalReference(raw)) return null;
  const candidate = raw.startsWith('/')
    ? raw.slice(1)
    : path.posix.normalize(path.posix.join(path.posix.dirname(sourceRelative), raw));
  if (!isAssetPath(candidate)) return null;
  if (candidate === 'assets' || candidate.startsWith('../') || candidate.includes('/../')) {
    throw new Error(`Asset reference escapes project root: ${sourceRelative} -> ${rawReference}`);
  }
  return candidate;
}

function localReference(sourceRelative, rawReference) {
  const raw = String(rawReference ?? '').trim().split(/[?#]/, 1)[0].replaceAll('\\', '/');
  if (isExternalReference(raw) || raw.startsWith('@') || !(raw.startsWith('/') || raw.startsWith('./') || raw.startsWith('../'))) return null;
  if (EXTERNAL_RUNTIME_PATHS.has(raw)) return null;
  const candidate = raw.startsWith('/')
    ? raw.slice(1)
    : path.posix.normalize(path.posix.join(path.posix.dirname(sourceRelative), raw));
  if (candidate.startsWith('../') || candidate.includes('/../')) {
    throw new Error(`dependency escapes project root: ${sourceRelative} -> ${rawReference}`);
  }
  if (isAssetPath(candidate)) return null;
  return candidate;
}

function textReferences(relative, text) {
  const extension = path.posix.extname(relative).toLowerCase();
  if (extension === '.html') return [...text.matchAll(HTML_DEPENDENCY_RE)].map(match => match[1]);
  if (extension === '.js' || extension === '.mjs') return [...text.matchAll(JS_IMPORT_RE)].map(match => match[1]);
  return [];
}

function assetReferences(relative, text) {
  const references = [];
  for (const match of text.matchAll(ASSET_STRING_RE)) references.push(match[1]);
  if (path.posix.extname(relative).toLowerCase() === '.css') {
    for (const match of text.matchAll(CSS_URL_RE)) references.push(match[1]);
  }
  return references.map(reference => normalizeAssetReference(relative, reference)).filter(Boolean);
}

function readText(root, relative) {
  const file = path.join(root, ...relative.split('/'));
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(fs.readFileSync(file));
  } catch (error) {
    if (error instanceof TypeError) throw new Error(`invalid UTF-8 text dependency: ${relative}`);
    throw new Error(`Unable to read runtime source ${relative}: ${error.message}`);
  }
}

function assertRegularFile(root, relative, label) {
  const file = path.join(root, ...relative.split('/'));
  const stat = fs.lstatSync(file, { throwIfNoEntry: false });
  if (!stat?.isFile()) throw new Error(`Missing ${label}: ${relative}`);
  return file;
}

function collectRuntimeSources(root, entrypoints) {
  const pending = entrypoints.map(posixRelative);
  const sourceFiles = new Set();
  const directAssetReferences = new Set();
  while (pending.length) {
    const relative = pending.pop();
    if (sourceFiles.has(relative)) continue;
    const file = assertRegularFile(root, relative, 'runtime entrypoint');
    const extension = path.posix.extname(relative).toLowerCase();
    sourceFiles.add(relative);
    if (!TEXT_EXTENSIONS.has(extension)) continue;
    const text = readText(root, relative);
    for (const asset of assetReferences(relative, text)) directAssetReferences.add(asset);
    for (const rawReference of textReferences(relative, text)) {
      const dependency = localReference(relative, rawReference);
      if (!dependency) continue;
      const dependencyFile = path.join(root, ...dependency.split('/'));
      if (!fs.existsSync(dependencyFile)) throw new Error(`unresolved local dependency: ${relative} -> ${rawReference}`);
      pending.push(dependency);
    }
  }
  return { sourceFiles: [...sourceFiles].sort(), directAssetReferences };
}

function loadAssetManifest(root) {
  const manifestPath = 'assets/asset-manifest.json';
  const manifest = JSON.parse(readText(root, manifestPath));
  if (manifest.schemaVersion !== 1) throw new Error(`Unsupported asset manifest schema: ${manifest.schemaVersion}`);
  const entries = [...(manifest.assets ?? []), ...(manifest.previewAssets ?? [])];
  if (!entries.length) throw new Error('Asset manifest contains no entries');
  return { manifestPath, entries };
}

export function collectRuntimeAssets(root, platform) {
  const entrypoints = platform === 'yandex' ? ['index.html'] : ['vk.html'];
  if (platform === 'yandex' && fs.existsSync(path.join(root, 'literary.html'))) entrypoints.push('literary.html');
  const { sourceFiles, directAssetReferences } = collectRuntimeSources(root, entrypoints);
  const { manifestPath, entries } = loadAssetManifest(root);
  const selected = new Map();
  const add = (relative, reason, manifestEntry = null) => {
    const normalized = posixRelative(relative);
    if (!isAssetPath(normalized)) throw new Error(`Runtime asset is outside assets/: ${normalized}`);
    assertRegularFile(root, normalized, 'runtime asset');
    const current = selected.get(normalized) ?? { path: normalized, reasons: [], manifestIds: [] };
    if (!current.reasons.includes(reason)) current.reasons.push(reason);
    if (manifestEntry?.id && !current.manifestIds.includes(manifestEntry.id)) current.manifestIds.push(manifestEntry.id);
    selected.set(normalized, current);
  };

  for (const reference of directAssetReferences) add(reference, 'runtime-source-reference');

  for (const entry of entries) {
    const runtimePaths = [entry.runtimePath, entry.runtimePortraitAsset].filter(Boolean);
    for (const runtimePath of runtimePaths) {
      const normalized = posixRelative(runtimePath);
      if (path.posix.extname(normalized).toLowerCase() === '.png' && entry.family !== 'branding' && !directAssetReferences.has(normalized)) {
        throw new Error(`Unconfirmed runtime PNG: ${normalized} (${entry.id ?? 'unnamed manifest entry'})`);
      }
      add(normalized, 'asset-manifest-runtime-path', entry);
    }
    if (!runtimePaths.length && entry.status === 'integrated' && RUNTIME_MANIFEST_FAMILIES.has(entry.family)) {
      if (!entry.path) throw new Error(`Integrated ${entry.family} entry has no path: ${entry.id ?? 'unnamed manifest entry'}`);
      add(entry.path, `asset-manifest-${entry.family}`, entry);
    }
  }

  const files = [...selected.keys()].sort((a, b) => a.localeCompare(b, 'en'));
  return {
    schemaVersion: 1,
    manifestPath,
    sourceFiles,
    files,
    entries: files.map(file => selected.get(file)).map(entry => ({
      ...entry,
      reasons: [...entry.reasons].sort(),
      manifestIds: [...entry.manifestIds].sort()
    }))
  };
}
