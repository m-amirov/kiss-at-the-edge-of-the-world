const SDK_PATH = '/sdk.js';
// Keep the cloud key stable so schema-2/3 cloud saves can be migrated in place.
const CLOUD_KEY = 'kiss-at-the-edge-of-the-world:season-1:v2';

function canLoadYandexSdk() {
  if (typeof window === 'undefined') return false;
  if (window.YaGames) return true;
  const host = window.location.hostname;
  return host.includes('yandex.') || host.endsWith('.yandex.net') || host.endsWith('.games.s3.amazonaws.com');
}

function loadSdkScript() {
  if (window.YaGames) return Promise.resolve(true);
  if (!canLoadYandexSdk()) return Promise.resolve(false);
  return new Promise(resolve => {
    const script = document.createElement('script');
    script.async = true;
    script.src = SDK_PATH;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.append(script);
  });
}

export async function initYandexPlatform({ onCloudState, onLanguage, onPause, onResume, cloudKey = CLOUD_KEY } = {}) {
  const loaded = await loadSdkScript();
  if (!loaded || !window.YaGames) return { mode: 'local-fallback', save: async () => {} };

  try {
    const ysdk = await window.YaGames.init();
    const language = ysdk.environment?.i18n?.lang || 'ru';
    onLanguage?.(language);
    let player = null;
    const pause = () => onPause?.();
    const resume = () => onResume?.();
    ysdk.on?.('game_api_pause', pause);
    ysdk.on?.('game_api_resume', resume);
    ysdk.features?.LoadingAPI?.ready?.();
    ysdk.features?.GameplayAPI?.start?.();

    try {
      player = await ysdk.getPlayer();
      const cloud = await player.getData?.([cloudKey]);
      if (cloud?.[cloudKey]) onCloudState?.(cloud[cloudKey]);
    } catch {
      // Anonymous or unavailable cloud storage must not block local play.
    }

    return {
      mode: 'yandex',
      language,
      save: async state => {
        try { await player?.setData?.({ [cloudKey]: state }, false); } catch { /* local save remains authoritative */ }
      },
      showFullscreenAd: () => new Promise(resolve => {
        const show = ysdk.adv?.showFullscreenAdv;
        if (!show) { resolve(false); return; }
        show.call(ysdk.adv, {
          callbacks: {
            onClose: () => resolve(true),
            onError: () => resolve(false)
          }
        });
      }),
      dispose: () => {
        ysdk.off?.('game_api_pause', pause);
        ysdk.off?.('game_api_resume', resume);
      }
    };
  } catch {
    return { mode: 'local-fallback', save: async () => {} };
  }
}

export function bindBrowserPauseFallback({ onPause, onResume } = {}) {
  const handleVisibility = () => document.hidden ? onPause?.() : onResume?.();
  document.addEventListener('visibilitychange', handleVisibility);
  return () => document.removeEventListener('visibilitychange', handleVisibility);
}
