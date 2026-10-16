import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const MIME_BY_EXTENSION = Object.freeze({
  '.css': 'text/css',
  '.gif': 'image/gif',
  '.html': 'text/html',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.mjs': 'text/javascript',
  '.ogg': 'audio/ogg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain',
  '.wav': 'audio/wav',
  '.webp': 'image/webp'
});

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

export function getGitHead(root) {
  return execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore']
  }).trim();
}

function walkFiles(root) {
  const files = [];
  const visit = (directory, prefix = '') => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      const absolute = path.join(directory, entry.name);
      const relative = path.posix.join(prefix, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`VK bundle contains symlink: ${relative}`);
      if (entry.isDirectory()) visit(absolute, relative);
      else if (entry.isFile()) files.push(relative);
      else throw new Error(`Unsupported bundle entry: ${relative}`);
    }
  };
  visit(root);
  return files;
}

export function bundleTreeSha256(bundleRoot) {
  const hasher = crypto.createHash('sha256');
  for (const relative of walkFiles(bundleRoot).sort()) {
    const file = path.join(bundleRoot, ...relative.split('/'));
    if (/\.(html|mjs|js|css)$/i.test(relative) &&
        /YaGames\.init|yandex-games-sdk|yandexGamesSDK|\/sdk\/_\//i.test(fs.readFileSync(file, 'utf8'))) {
      throw new Error(`Yandex SDK marker in VK bundle: ${relative}`);
    }
    hasher.update(relative);
    hasher.update('\0');
    hasher.update(fs.readFileSync(file));
    hasher.update('\0');
  }
  return hasher.digest('hex');
}

function safeBundlePath(bundleRoot, relative) {
  if (typeof relative !== 'string' || !relative || relative.includes('\0') || path.isAbsolute(relative) || /^[A-Za-z]:[\\/]/.test(relative)) {
    throw new Error(`Unsafe bundle path: ${relative}`);
  }
  const normalized = path.posix.normalize(relative.replaceAll('\\', '/'));
  if (normalized === '..' || normalized.startsWith('../')) throw new Error(`Unsafe bundle path: ${relative}`);
  const absolute = path.resolve(bundleRoot, ...normalized.split('/'));
  const rel = path.relative(path.resolve(bundleRoot), absolute);
  if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) throw new Error(`Unsafe bundle path: ${relative}`);
  return { normalized, absolute };
}

function relativeReferences(text) {
  const refs = new Set();
  const collect = (pattern, group = 1) => {
    for (const match of text.matchAll(pattern)) refs.add(match[group]);
  };
  collect(/(?:src|href)\s*=\s*["']([^"']+)["']/gi);
  collect(/url\(\s*["']?([^"')]+)["']?\s*\)/gi);
  return [...refs].filter((value) => {
    const ref = value.trim();
    return ref && !ref.includes('${') && !ref.startsWith('#') && !/^(?:data|blob|https?):/i.test(ref) && !ref.startsWith('//') && !/^(?:javascript|mailto):/i.test(ref);
  });
}

function resolveReference(bundleRoot, fromFile, reference) {
  const clean = reference.split('#', 1)[0].split('?', 1)[0];
  if (!clean) return null;
  if (clean.startsWith('/')) return safeBundlePath(bundleRoot, clean.slice(1)).normalized;
  const fromDirectory = path.posix.dirname(fromFile);
  const normalized = path.posix.normalize(path.posix.join(fromDirectory, clean));
  return safeBundlePath(bundleRoot, normalized).normalized;
}

function expectedMime(relative) {
  return MIME_BY_EXTENSION[path.posix.extname(relative).toLowerCase()] ?? 'application/octet-stream';
}

function mimeMatches(actual, expected) {
  const type = String(actual ?? '').split(';', 1)[0].trim().toLowerCase();
  if (expected === 'text/javascript') return type === 'text/javascript' || type === 'application/javascript';
  if (expected === 'font/ttf') return type === 'font/ttf' || type === 'application/octet-stream';
  return type === expected;
}

export function validateRemoteUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Remote hosting URL must be an absolute URL'); }
  if (url.protocol !== 'https:') throw new Error('Remote hosting URL must use HTTPS');
  if (url.username || url.password) throw new Error('Remote hosting URL must not contain credentials');
  url.hash = '';
  url.search = '';
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url;
}

export function auditLocalBundle(root = ROOT) {
  const bundleRoot = path.resolve(root, 'dist/vk');
  const errors = [];
  const warnings = [];
  if (!fs.existsSync(bundleRoot) || !fs.statSync(bundleRoot).isDirectory()) {
    return { status: 'FAIL', errors: ['dist/vk is missing'], warnings, bundleRoot };
  }

  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(path.join(bundleRoot, 'build-manifest.json'), 'utf8')); }
  catch (error) { return { status: 'FAIL', errors: [`invalid build-manifest.json: ${error.message}`], warnings, bundleRoot }; }

  let sourceHead = null;
  try { sourceHead = getGitHead(path.resolve(root)); }
  catch { errors.push('git HEAD could not be verified'); }
  if (manifest.sourceHead !== sourceHead) errors.push(`manifest sourceHead ${manifest.sourceHead} does not match HEAD ${sourceHead}`);
  if (manifest.platform !== 'vk' || manifest.entry !== 'index.html' || !Array.isArray(manifest.files)) errors.push('invalid VK build manifest contract');

  let actualFiles = [];
  try { actualFiles = walkFiles(bundleRoot); }
  catch (error) { errors.push(error.message); }
  const manifestFiles = new Set((manifest.files ?? []).map((item) => item.path));
  const actualContentFiles = actualFiles.filter((file) => file !== 'build-manifest.json');
  for (const relative of manifestFiles) {
    try {
      const { absolute } = safeBundlePath(bundleRoot, relative);
      if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) errors.push(`manifest file missing: ${relative}`);
      else if (sha256(absolute) !== manifest.files.find((item) => item.path === relative)?.sha256) errors.push(`manifest hash mismatch: ${relative}`);
    } catch (error) { errors.push(error.message); }
  }
  for (const relative of actualContentFiles) if (!manifestFiles.has(relative)) errors.push(`unlisted bundle file: ${relative}`);
  if (!actualFiles.includes('build-manifest.json')) errors.push('build-manifest.json is missing');

  const textFiles = actualFiles.filter((file) => /\.(html|mjs|js|css)$/i.test(file));
  for (const fromFile of textFiles) {
    const text = fs.readFileSync(path.join(bundleRoot, ...fromFile.split('/')), 'utf8');
    for (const reference of relativeReferences(text)) {
      try {
        const resolved = resolveReference(bundleRoot, fromFile, reference);
        if (resolved && !actualFiles.includes(resolved)) errors.push(`missing relative resource: ${fromFile} -> ${reference}`);
      } catch (error) { errors.push(error.message); }
    }
  }

  const audioFiles = actualFiles.filter((file) => file.toLowerCase().endsWith('.ogg'));
  const externalAudio = manifest.externalAudio ?? null;
  if (externalAudio) {
    try {
      const url = new URL(externalAudio.baseUrl);
      if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !url.pathname.endsWith('/')) {
        errors.push('invalid external audio HTTPS URL');
      }
    } catch { errors.push('invalid external audio HTTPS URL'); }
    if (!Array.isArray(externalAudio.files) || externalAudio.files.length !== 8) errors.push('external audio must contain eight OGG entries');
    for (const item of externalAudio.files ?? []) {
      if (!/^assets\/audio\/music\/[^/]+\.ogg$/i.test(item.path) || !/^[a-f0-9]{64}$/.test(item.sha256)) errors.push('invalid external audio manifest entry');
      if (actualFiles.includes(item.path)) errors.push(`externally hosted audio included in bundle: ${item.path}`);
    }
    if (audioFiles.length) errors.push('external audio build still contains local OGG');
    warnings.push('external audio requires HTTPS/MIME playback audit before release');
  } else if (audioFiles.length !== 8) errors.push('VK bundle must contain eight local OGG tracks');
  for (const relative of actualFiles) {
    const mime = expectedMime(relative);
    if (mime === 'application/octet-stream') warnings.push(`no explicit MIME mapping: ${relative}`);
  }
  const bundleSha256 = (() => {
    try { return bundleTreeSha256(bundleRoot); }
    catch (error) { errors.push(error.message); return null; }
  })();
  const result = {
    status: errors.length ? 'FAIL' : 'PASS',
    sourceHead,
    bundleSha256,
    bundleRoot,
    fileCount: actualFiles.length,
    totalBytes: actualFiles.reduce((sum, relative) => sum + fs.statSync(path.join(bundleRoot, ...relative.split('/'))).size, 0),
    audioFiles,
    externalAudio,
    errors,
    warnings,
    files: actualFiles.map((relative) => ({ path: relative, bytes: fs.statSync(path.join(bundleRoot, ...relative.split('/'))).size, mime: expectedMime(relative) }))
  };
  return result;
}

async function fetchWithFallback(url, fetchImpl) {
  let response = await fetchImpl(url, { method: 'HEAD', redirect: 'follow' });
  if (response.status === 405 || response.status === 501) {
    response = await fetchImpl(url, { method: 'GET', headers: { Range: 'bytes=0-0' }, redirect: 'follow' });
  }
  return response;
}

export async function auditRemoteBundle(root, url, { fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('Node fetch is required for remote hosting audit');
  const local = auditLocalBundle(root);
  if (local.status !== 'PASS') return { status: 'FAIL', local, errors: ['local VK bundle audit failed'] };
  const base = validateRemoteUrl(url);
  const errors = [];
  const checked = [];
  const indexUrl = new URL('index.html', base).toString();
  const indexResponse = await fetchImpl(indexUrl, { method: 'GET', redirect: 'follow' });
  if (!indexResponse.ok) errors.push(`index.html returned HTTP ${indexResponse.status}`);
  if (!String(indexResponse.url || indexUrl).startsWith('https://')) errors.push('remote redirect left HTTPS');
  const contentType = indexResponse.headers.get('content-type');
  if (!mimeMatches(contentType, 'text/html')) errors.push(`index.html MIME is ${contentType || '<missing>'}, expected text/html`);
  const xFrame = (indexResponse.headers.get('x-frame-options') || '').toLowerCase();
  const csp = (indexResponse.headers.get('content-security-policy') || '').toLowerCase();
  if (xFrame.includes('deny') || xFrame.includes('sameorigin')) errors.push(`iframe-blocking X-Frame-Options: ${xFrame}`);
  if (/(?:^|;)\s*frame-ancestors\s+(?:'none'|'self')(?:\s|;|$)/.test(csp)) errors.push('restrictive CSP frame-ancestors blocks VK/OK embedding');
  if (indexResponse.ok) {
    const indexText = await indexResponse.text();
    for (const reference of relativeReferences(indexText)) {
      try {
        const resolved = resolveReference(path.resolve(root, 'dist/vk'), 'index.html', reference);
        checked.push(resolved);
      } catch (error) { errors.push(error.message); }
    }
  }
  for (const item of local.externalAudio?.files ?? []) {
    const name = item.path.split('/').at(-1);
    const remoteUrl = new URL(name, local.externalAudio.baseUrl).toString();
    const response = await fetchWithFallback(remoteUrl, fetchImpl);
    checked.push(item.path);
    if (!response.ok) errors.push(`external audio ${name} returned HTTP ${response.status}`);
    if (response.ok && !mimeMatches(response.headers.get('content-type'), 'audio/ogg')) {
      errors.push(`external audio ${name} has incorrect MIME`);
    }
    if (!String(response.url || remoteUrl).startsWith('https://')) errors.push(`external audio ${name} redirected outside HTTPS`);
  }
  for (const file of local.files) {
    const fileUrl = new URL(file.path, base).toString();
    const response = await fetchWithFallback(fileUrl, fetchImpl);
    const remoteType = response.headers.get('content-type');
    checked.push(file.path);
    if (!response.ok) errors.push(`${file.path} returned HTTP ${response.status}`);
    if (response.ok && !mimeMatches(remoteType, file.mime)) errors.push(`${file.path} MIME is ${remoteType || '<missing>'}, expected ${file.mime}`);
  }
  return {
    status: errors.length ? 'FAIL' : 'PASS',
    url: base.toString(),
    sourceHead: local.sourceHead,
    bundleSha256: local.bundleSha256,
    iframeCompatible: !xFrame && !/(?:^|;)\s*frame-ancestors\s+(?:'none'|'self')(?:\s|;|$)/.test(csp),
    checkedCount: new Set(checked).size,
    errors,
    local
  };
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(argument('--root') ?? ROOT);
  const url = argument('--url');
  try {
    const result = url ? await auditRemoteBundle(root, url) : auditLocalBundle(root);
    const output = process.argv.includes('--verbose') ? result : {
      status: result.status,
      url: result.url,
      sourceHead: result.sourceHead,
      bundleSha256: result.bundleSha256,
      fileCount: result.fileCount ?? result.local?.fileCount,
      totalBytes: result.totalBytes ?? result.local?.totalBytes,
      audioFiles: result.audioFiles ?? result.local?.audioFiles,
      externalAudio: result.externalAudio ?? result.local?.externalAudio,
      checkedCount: result.checkedCount,
      iframeCompatible: result.iframeCompatible,
      errors: result.errors,
      warnings: result.warnings
    };
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    process.exitCode = result.status === 'PASS' ? 0 : 2;
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ status: 'BLOCKED_VK_HOSTING_AUDIT', reason: error.message }, null, 2)}\n`);
    process.exitCode = 2;
  }
}
