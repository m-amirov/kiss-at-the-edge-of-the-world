const CLOUD_KEY = 'kiss-at-the-edge-of-the-world:season-1:v2';

export function isLocalDevelopment(location = globalThis.location) {
  if (!location) return true;
  return location.protocol === 'file:' || ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
}
export function normalizeYandexLocale(value) { return String(value || '').toLowerCase().startsWith('ru') ? 'ru' : 'en'; }
export function requestedQaLocale(location = globalThis.location) {
  if (!isLocalDevelopment(location)) return null;
  const value = new URLSearchParams(location?.search || '').get('lang');
  return value === 'ru' || value === 'en' ? value : null;
}
export function resetYandexSdkForTests() {}
function localPlatform(locale, diagnostic, qaLocaleOverride = null) {
  diagnostic('sdk', 'local-fallback');
  return { mode:'local-fallback', locale, language:locale, qaLocaleOverride, markInteractiveReady(){}, setGameplayActive(){}, save:async()=>false, showFullscreenAd:async()=>false, dispose(){} };
}
export async function initYandexPlatform({ onCloudState, onLanguage, onPause, onResume, onDiagnostic, cloudKey=CLOUD_KEY, location=globalThis.location, window=globalThis.window }={}) {
  const events=[];
  const diagnostic=(area,status,detail=null)=>{const event={area,status,...(detail?{detail}:{})};events.push(event);onDiagnostic?.(event);};
  const qaLocaleOverride=isLocalDevelopment(location)?requestedQaLocale(location):null;
  const sdkInit=window?.__YANDEX_GAMES_INIT__;
  if(isLocalDevelopment(location) && !sdkInit)return localPlatform(qaLocaleOverride||'ru',diagnostic,qaLocaleOverride);
  let ysdk;
  try { ysdk=await sdkInit; diagnostic('sdk','initialized'); }
  catch(error){ diagnostic('sdk','init-failed',error?.message||String(error)); throw new Error(`YANDEX_SDK_INIT_FAILED: ${error?.message||error}`,{cause:error}); }
  const locale=normalizeYandexLocale(ysdk.environment?.i18n?.lang);onLanguage?.(locale);diagnostic('language','resolved',locale);
  let player=null;
  try { player=await ysdk.getPlayer();diagnostic('player','ready');const cloud=await player.getData?.([cloudKey]);diagnostic('cloud-read','success');if(cloud?.[cloudKey]!==undefined)onCloudState?.(cloud[cloudKey]); }
  catch(error){diagnostic('cloud-read','failed',error?.message||String(error));}
  let readySent=false,gameplayWanted=false,platformPaused=false,gameplayReported=false;
  const syncGameplay=()=>{const active=gameplayWanted&&!platformPaused;if(active===gameplayReported)return;gameplayReported=active;ysdk.features?.GameplayAPI?.[active?'start':'stop']?.();diagnostic('gameplay',active?'started':'stopped');};
  const pause=()=>{platformPaused=true;syncGameplay();onPause?.();};const resume=()=>{platformPaused=false;syncGameplay();onResume?.();};ysdk.on?.('game_api_pause',pause);ysdk.on?.('game_api_resume',resume);
  return {mode:'yandex',locale,language:locale,qaLocaleOverride:null,diagnostics:events,
    markInteractiveReady(){if(readySent)return false;readySent=true;ysdk.features?.LoadingAPI?.ready?.();diagnostic('loading','ready');return true;},
    setGameplayActive(active){gameplayWanted=Boolean(active);syncGameplay();},
    async save(state){if(!player?.setData){diagnostic('cloud-write','unavailable');return false;}try{await player.setData({[cloudKey]:state},false);diagnostic('cloud-write','success');return true;}catch(error){diagnostic('cloud-write','failed',error?.message||String(error));return false;}},
    showFullscreenAd:()=>new Promise(resolve=>{const show=ysdk.adv?.showFullscreenAdv;if(!show){resolve(false);return;}const resumeAfter=gameplayWanted;platformPaused=true;syncGameplay();show.call(ysdk.adv,{callbacks:{onClose:()=>{platformPaused=false;gameplayWanted=resumeAfter;syncGameplay();resolve(true);},onError:()=>{platformPaused=false;gameplayWanted=resumeAfter;syncGameplay();resolve(false);}}});}),
    dispose(){ysdk.off?.('game_api_pause',pause);ysdk.off?.('game_api_resume',resume);}
  };
}
export function bindBrowserPauseFallback({onPause,onResume}={}){const handleVisibility=()=>document.hidden?onPause?.():onResume?.();document.addEventListener('visibilitychange',handleVisibility);return()=>document.removeEventListener('visibilitychange',handleVisibility);}
