# VK Games integration

The game has one narrative/runtime implementation and two explicit platform
entry points:

- `index.html` → `src/entry.js` → Yandex adapter;
- `vk.html` → `src/vk-entry.js` → VK Bridge adapter.

Builds are independent and are produced by the existing Node build tool:

```text
npm run build:yandex
npm run build:vk
```

The VK build packages `@vkontakte/vk-bridge` locally as
`vendor/vk-bridge.js` and excludes the Yandex adapter and `/sdk.js`. The
Yandex build excludes the VK entry point and bridge bundle.

## Runtime contract

`src/platform/vk-games.js` owns only platform concerns. The literary player
uses the same `save`/`load` contract for both platforms and keeps the
narrative state in `src/save-state.js`.

VK storage is addressed with the safe key `kiss_literary_season_v1`; the old
Yandex cloud key is not passed to VK because VK Storage keys do not accept
colon separators. Writes are limited to 3800 UTF-8 bytes and are verified by
readback. Invalid JSON, malformed responses, unavailable storage and a
readback mismatch are observable errors; they never silently replace progress
with a fresh save.

Interstitial ads are requested only after an episode boundary. Dialogue,
choices and romantic scenes do not call the ad API. Rewarded ads are disabled.
Bridge hide/restore and browser focus/visibility events pause and resume the
game idempotently.

## Local checks

Use the game-owned opt-in profile and a generated VK build:

```text
npm run test:vk
npm run build:vk
npm run vk:validate -- --root . --profile config/vk-games.local.json
```

For browser smoke testing, open `/vk.html?mock=1&lang=ru` or
`/vk.html?mock=1&lang=en`. The mock bridge is only a local test adapter; it is
not release evidence.

## Release boundary

The Starter Kit release validator requires fresh real-client observations for
VK Web/Android/iOS and OK Web/Android/iOS, bound to the exact Git HEAD and VK
bundle hash. Until those observations exist, the result remains
`BLOCKED_EXTERNAL_VK_EVIDENCE`; this branch is not a VK release candidate.
