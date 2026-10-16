# VK Games optional platform profile — Starter Kit 0.5.14

## Architecture / boundaries

This is a distribution profile for VK Games in VKontakte and Odnoklassniki. It is NOT a VK Play integration. Existing Yandex games remain Yandex-only by default. Reuse the game core, art, narrative and save schema, but create separate platform adapters and independently built bundles.

- Common game core -> Yandex adapter -> build:yandex
- Common game core -> VK Bridge adapter -> build:vk
- No VK SDK in the Yandex bundle, no Yandex SDK in the VK bundle.
- Mature-project updater must not touch src, public, index.html, game-spec.yaml or project-owned bundler configuration. The reference adapter in templates is **not** activated automatically.
- Yandex platform compliance does not certify VK; VK checks do not certify Yandex. No release can be promoted from static PASS.

Official references (review for policy/API changes before submission):
- https://dev.vk.com/ru/admin/create-app
- https://github.com/VKCOM/vk-bridge/tree/master/packages/core
- https://dev.vk.com/ru/mini-apps/monetization/ads
- https://ok.ru/apiok/topic/157695278809208

## Enable in a game (explicit opt-in)

1. Install a reviewed and pinned version of @vkontakte/vk-bridge in the target game, not Starter Kit. Upstream v2.x warns about incompatible 3.x changes.
2. Copy templates/platform/vk-bridge-adapter.mjs into a game-owned VK module (example: src/platform/vk-games.mjs) and inject the imported VK Bridge singleton. Wire pause/resume to game and audio lifecycle. Build a *separate* VK HTML entry. Never bundle both SDKs.
3. Copy templates/platform/vk-games.contract.example.json to platform/vk-games.contract.json and update actual buildFile, bundleDir, adapterFile, distributions, and policies.
4. Explicitly set enabled=true in the **game-owned** config/optional-profiles/vk-games.json. Never flip this template globally for all games.
5. Build the VK target and run the static validator:

~~~sh
npm run vk:validate -- --root .
~~~

PASS_VK_STATIC_CONTRACT confirms only that the declared VK build, adapter and static policy checks exist. It explicitly returns releaseReady=false.

6. In the VK developer console configure hosted HTTPS game, URL, permissions and screenshots for each selected distribution. Test on real clients. Record runtime evidence only after actual observation:

~~~sh
npm run vk:validate -- --root . --release
~~~

Expected runtime evidence path: artifacts/evidence/vk-games-runtime.json, example structure:

~~~json
{
  "schemaVersion": 1,
  "sourceHead": "40-character actual game git commit",
  "bundleSha256": "64-character SHA-256 of the actual VK HTML entry",
  "capturedAt": "2026-10-16T10:00:00Z",
  "clients": [
    {
      "client": "vk-web",
      "source": "real-client-observation",
      "status": "PASS",
      "checks": {
        "init": true,
        "pauseResume": true,
        "input": true,
        "portrait": true,
        "saveRoundTrip": true,
        "ads": true,
        "noYandexSdk": true
      }
    }
  ]
}
~~~

For distribution vk, required client rows are vk-web, vk-android, vk-ios. For ok, required rows are ok-web, ok-android, ok-ios. Include ALL rows applicable to the selected distributions. Every check must derive from real client behavior, not mocks. The checker binds evidence to current game git HEAD and VK bundle tree SHA256, and rejects stale, missing or incomplete data. A self-written JSON is not provider attestation; review the underlying video/network/log evidence independently.

## Ads and storage safety

Use VKWebAppCheckNativeAds then VKWebAppShowNativeAds. Only interrupt at an episode/scene boundary, never during dialogue. Handle unavailable/error results without blocking story progression. Rewarded is disabled by default; a show API response is not by itself permission to grant premium content. The first free visual novel needs no paid-choice mechanics.

Use VKWebAppStorageSet/Get for explicit small saves. The reference adapter verifies UTF-8 size (conservative max 3800 bytes) and reads back every write before claiming success. If a state is larger, implement chunking with atomic versioned metadata, digest verification, and tested failure recovery; never silently reset or mix local and cloud state. Test migration/version handling on real clients.

## Release gates (manual checks remain manual)

The machine gate does not replace real moderation or revenue verification. Before reporting a VK release as ready:

- Check desktop web, mobile VK and OK Android/iOS, correct portrait content, touch input, no automatic choice activation, back/history rollback, no overlap, pause/resume and audio focus.
- Validate saves through restart/reopen, storage failures, migration and corrupt saves, plus correct split of SDK/network requests.
- Confirm ads are configured/enabled, ad errors do not block progress, displayed only at story boundaries.
- Confirm hosting, HTTPS/CSP, launch parameters validation, assets and localization.
- Verify rights, privacy, metadata, social app moderation requirements, telemetry, payments/payouts.
- Preserve separate platform-specific build and source SHA evidence.

No game release ZIP, moderation submission, or false release PASS is produced by enabling the profile.

## Official VK Mini Apps Hosting: guarded dev deploy

The official `@vkontakte/vk-miniapps-deploy` package is used only as a manually invoked deploy client. Versions below `1.0.0` are unsupported; this project pins the current inspected `1.0.3` in `tools/platform/vk-deploy-dev.mjs` without adding an access token to Git.

The tracked `vk-hosting-config.json` uses the real app ID from the authorized VK Developer Console, `54782569`, and maps `dist/vk/index.html` to `web`, `mobile` and `mvk`. It has `update_prod: false` and `update_dev: true`.

1. Build the exact VK bundle: `npm run build:vk`.
2. Run the explicit guarded command: `npm run vk:deploy:dev -- --confirm-dev`.
3. The launcher forces `MINI_APPS_ENVIRONMENT=dev`, enables URL reporting, refuses to run without `--confirm-dev`, and refuses a config that can update production URLs.
4. Authentication is obtained by the official CLI through its local config store/OAuth flow or an explicitly supplied `MINI_APPS_ACCESS_TOKEN`; tokens must never be written to the repository or command history.
5. Preserve the three returned HTTPS dev URLs and bind them to the exact source HEAD and VK bundle digest in runtime evidence. A successful upload is not real-client acceptance.

The dev launcher is intentionally not a CI job, `predeploy` hook or production script. If the account is not an owner/admin of the app, the deploy remains blocked at the provider authorization step.

## Hosting attempt at current HEAD

At `734c7395950ec0a6e49463fe8217951058e33e5e` the guarded command was executed with an owner-authorized OAuth token supplied only through the process environment. The package reached VK Hosting and uploaded `build.zip` (`460988432` bytes, SHA-256 `47b174aaf579cc4ea6e4375a1c3035b60ce397792c1796ef4efbb9f9e9aa6732`), but the provider rejected task creation with the exact response `Error: 15 Access denied: invalid file`. No HTTPS dev URL was returned; the console still reports that the application is unavailable by URL.

This is an external hosting blocker, not a local or mock runtime PASS. Before retrying, the app owner must clarify with VK whether app `54782569` is eligible for Mini Apps Hosting through `@vkontakte/vk-miniapps-deploy@1.0.3` and whether the uploaded archive is subject to a hosting limit or a VK Games-specific packaging rule. Do not switch to production, publish, moderate or treat OK as verified until a real URL and client evidence exist.
