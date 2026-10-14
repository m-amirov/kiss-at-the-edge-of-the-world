const ASSET_ROOT = new URL('../assets/', import.meta.url);

function normalizedAssetPath(value) {
  const raw = String(value ?? '').trim().replaceAll('\\', '/');
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(raw)) throw new Error(`RUNTIME_ASSET_PATH_EXTERNAL: ${value}`);
  let path = raw.replace(/^\/+/, '');
  path = path.replace(/^(?:\.\.\/|\.\/)?assets\//, '');
  if (!path || path.split('/').some(segment => segment === '..')) throw new Error(`RUNTIME_ASSET_PATH_ESCAPE: ${value}`);
  return path;
}

export function resolveRuntimeAssetUrl(value, assetRoot = ASSET_ROOT) {
  const path = normalizedAssetPath(value);
  const url = new URL(path, assetRoot);
  if (url.origin !== assetRoot.origin || !url.pathname.startsWith(assetRoot.pathname)) throw new Error(`RUNTIME_ASSET_PATH_ESCAPE: ${value}`);
  return url.href;
}

export function runtimeAssetUrl(value) {
  return resolveRuntimeAssetUrl(value, ASSET_ROOT);
}
