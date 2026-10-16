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

The bundle contains eight `.ogg` files (4,672,616 bytes). VK's deploy repository documents that static hosting rejects audio files and points to the hosting restrictions; this is consistent with the provider rejection. Do not silently strip audio from the game build. A retry requires an owner-approved VK-supported asset-hosting arrangement or an explicit platform exception, followed by a fresh exact-HEAD build and real-client evidence. See the [official deploy issue and hosting restriction note](https://github.com/VKCOM/vk-miniapps-deploy/issues/3).

This is an external hosting blocker, not a local or mock runtime PASS. Before retrying, the app owner must also clarify with VK whether app `54782569` is eligible for Mini Apps Hosting through `@vkontakte/vk-miniapps-deploy@1.0.3`. Do not switch to production, publish, moderate or treat OK as verified until a real URL and client evidence exist.

## Hosting-size diagnosis and HTTPS alternative

The current official [VK Games static hosting limits](https://dev.vk.ru/ru/games/development/hosting/overview) are material to this bundle: the ZIP archive is limited to 300 MB, and audio/video files cannot be placed on VK Hosting. The failed upload archive at the earlier exact HEAD was 460,988,432 bytes (SHA-256 `47b174aaf579cc4ea6e4375a1c3035b60ce397792c1796ef4efbb9f9e9aa6732`), so the rejection cannot be attributed to `.ogg` alone. The **historic** unoptimized VK output was 404 files / 465,725,183 bytes. This is no longer the current build: the shared runtime-asset selector reduced ordinary VK output to approximately 52.5 MB while preserving all eight tracks. The same official page documents `Error: 15` only as an app/configuration error for which `app_id` should be checked; it is not evidence that the audio files alone caused the response. Both the archive-size and media restrictions must therefore be treated as independent blockers.

The full VK bundle has a guarded external-hosting path for a manual Cloudflare Pages preview. Its configuration is [config/platform/vk-external-hosting.json](../config/platform/vk-external-hosting.json), and the launcher is `npm run vk:deploy:cloudflare:preview -- --confirm-preview`. It requires an owner-provided `CF_PAGES_PROJECT_NAME`, `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` in the process environment, always uses a non-production preview branch, and never stores those values in Git. The pinned Wrangler version is `4.151.0`.

Cloudflare Pages documents a 20,000-file Free-plan limit and a 25 MiB maximum for one asset ([limits](https://developers.cloudflare.com/pages/platform/limits/)); this bundle has 404 files and its largest file is below 5 MB, so neither documented per-file nor file-count limit is a blocker. A Pages URL is not considered usable until the audit command verifies HTTPS, every manifest path, MIME types, audio, and the absence of `X-Frame-Options`/restrictive `frame-ancestors` headers that would prevent VK/OK iframe embedding. Run `npm run vk:hosting:audit` for the local exact-HEAD check and `npm run vk:hosting:audit -- --url https://<owner-provided-pages-url>/` only after a real URL exists. The engine keeps relative/local resource paths; no external asset URL is injected.

At the time of this change no authorized Cloudflare project, token or deployed URL is available in the environment, so the alternative deploy remains `BLOCKED_EXTERNAL_CLOUDFLARE_AUTH`. Do not treat this local audit or a mock as VK Web/Android/iOS or OK Web/Android/iOS runtime evidence. After the owner supplies authorized access, deploy only a preview, record the returned HTTPS URL together with the exact source HEAD and bundle SHA-256, then perform the real-client matrix before any release decision.

### Основной РФ-доступный preview: Yandex Object Storage

Yandex Object Storage is the primary external-hosting candidate for a Russian-accessible VK preview. The project configuration is [config/platform/yandex-object-storage-preview.json](../config/platform/yandex-object-storage-preview.json), and the guarded launcher is `npm run vk:deploy:yandex:preview`. It reuses [vk-hosting-audit.mjs](../tools/platform/vk-hosting-audit.mjs), requires a fresh `dist/vk` audit, uploads the complete tree including all eight `.ogg`, sets an explicit MIME on every object and reports the exact source HEAD and bundle SHA-256.

The safe default is **object mode**: a dot-free bucket, `https://<bucket>.storage.yandexcloud.net/index.html`, public object read only, no public listing and no public write. The launcher is preview-only and does not create a bucket, change ACLs or upload anything unless all of `--confirm-preview --owner-authorized --allow-public-read --upload` are supplied. Bucket creation additionally requires `--create-bucket`. The command uses the official `yc storage bucket` and `yc storage s3api put-object` operations; credentials stay in the local Yandex Cloud CLI profile and never enter Git or command output.

Use the non-mutating plan first:

~~~sh
npm run vk:deploy:yandex:preview -- --plan
~~~

Required values are supplied outside Git: `YC_VK_PREVIEW_BUCKET` (3–63 lowercase characters, no dots, and no production-like name), optionally `YC_VK_PREVIEW_FOLDER_ID` and `YC_PROFILE`. The bucket name has no dots so the object endpoint has wildcard HTTPS coverage. A real owner must separately approve the bucket, public object read and the cost of storing/serving the preview; no resource is created automatically by this repository.

There is an official Yandex limitation that must not be hidden: static **website** hosting requires public object listing in addition to public object read ([hosting setup](https://yandex.cloud/en/docs/storage/operations/hosting/setup), [public access](https://yandex.cloud/en/docs/storage/operations/buckets/bucket-availability)). Therefore `https://<bucket>.website.yandexcloud.net/` is available only in an explicitly owner-authorized `--mode website --allow-public-list` flow. This project does not enable that flow by default and will fail closed instead of widening access. The read-only object endpoint is the compatible option under the current “no public listing” constraint. A website configuration, when separately approved, uses `index.html` for both index and SPA fallback; Yandex documents HTTPS for dot-free bucket names ([HTTPS](https://yandex.cloud/en/docs/storage/operations/hosting/certificate)).

After a real owner-authorized upload, run `npm run vk:hosting:audit -- --url https://<actual-object-or-website-url>/` and preserve the response as remote evidence. The audit must pass HTTPS, every manifest resource, JS/CSS/JSON/OGG/PNG MIME, relative paths and iframe headers before any VK/OK client checks. As of the current worktree there is no `yc` CLI, bucket, authorized Yandex profile or URL, so no deploy or remote audit was attempted and the external hosting state remains blocked.

## Official VK Hosting with external OGG (optional build)

The default `npm run build:vk` still ships all 8 OGG files and remains the
appropriate option for local tests and whole-bundle external hosting.

For the official VK static host, use an owner-approved *public HTTPS audio
directory* (with no URL tokens or credentials) and the explicit command:

```sh
# Set VK_AUDIO_BASE_URL in the local environment to https://<actual-audio-host>/.../
npm run build:vk:hosting
npm run vk:hosting:audit
```

The guard rejects missing, non-HTTPS, credential-bearing, query-bearing and
non-directory audio URLs **before** cleaning `dist/vk`. The VK-specific
`src/vk-audio-config.js` is then injected with the chosen base. The resulting
manifest records the 8 externally hosted OGG files with their SHA-256 hashes,
and the official VK Hosting upload includes no OGG. The common audio
director retains local audio paths for Yandex and ordinary VK builds.

The local audit does not prove that externally hosted OGG exist: the remote
audit additionally checks all eight external URLs for HTTPS/HTTP and
`audio/ogg` MIME. Test actual playback and lifecycle behavior on real VK/OK
devices before marking release gates as satisfied. The audio host has not
been provisioned; the external URL must never be invented or embedded until
it exists and owner authorization is obtained.

Cloudflare Pages and Yandex Object Storage **full-bundle** preview deploy
scripts fail closed when pointed at a split-audio VK Hosting output, to avoid
mistakenly deploying an incomplete game. Restore the full local-audio bundle
with `npm run build:vk` before those fallback deploy modes. Do not
automatically deploy, incur paid cloud charges, change VK production URL,
publish or submit moderation.
