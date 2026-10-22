# Runtime asset packaging for VK Games and Yandex Games

## Root cause

`tools/platform/build.mjs` previously copied the complete `assets/` tree for both
platforms. The tree contains production masters and review candidates alongside
the runtime WebP derivatives, so a platform build shipped both sides of every
transcode pair. The build therefore carried roughly 415.6 MB of PNG masters in
addition to roughly 42.2 MB of runtime WebP, instead of following the existing
Yandex release closure.

The existing Yandex packager starts from the HTML entrypoints and follows local
source dependencies. Its asset extension uses `assets/asset-manifest.json` and
`runtimePath`/`runtimePortraitAsset`, with explicit static branding and source
references. The previous implementation did not model the platform builds and
could also treat the official `/sdk.js` loader as a local archive dependency.

## Shared selection contract

`tools/platform/runtime-assets.mjs` is the single selector used by
`build:vk`, `build:yandex`, and `release-artifacts/build-rc-package.py` through
`runtime-assets-cli.mjs`.

1. It walks only the selected platform entrypoints and their local JS/CSS
   dependency closure. `/sdk.js` remains an external Yandex loader.
2. It adds manifest-declared `runtimePath` and `runtimePortraitAsset` files,
   including preview-integrated entries with a runtime path.
3. It adds all integrated `music` and `font` manifest paths because music files
   are selected dynamically from cue IDs and therefore cannot be discovered by
   a literal filename scan.
4. It adds direct runtime asset references from HTML, JS and CSS.
5. A PNG runtime path is accepted only for the branding family or when a
   runtime source directly references that exact PNG. Missing selected files,
   invalid UTF-8 source, unresolved imports and root escapes fail before an
   existing platform output is replaced.

Each platform output contains `build-manifest.json` schema 2 with the selected
asset list, source closure and manifest IDs/reasons. The output is deterministic
for the same source tree and HEAD.

## Included and excluded categories

Included:

- runtime WebP desktop and portrait derivatives selected by the manifest;
- all 8 music OGG files;
- both bundled variable fonts;
- the two branding PNG files and the branding menu WebP;
- the platform-specific source closure and platform adapter (VK Bridge only in
  the VK output; Yandex SDK only in the Yandex output).

Excluded:

- source/master PNG files whose manifest runtime mapping points to WebP;
- unused candidates, unassigned assets, art evidence, review captures and
  production-only metadata;
- the other platform's entrypoint and adapter;
- the official Yandex `/sdk.js` loader.

The selector does not transform, crop, recompress or otherwise modify any
runtime image. It only chooses the already accepted runtime derivative.

## Verification commands

```text
npm run build:vk
npm run build:yandex
node --test tests/platform/platform-build.test.mjs
node --test tests/release/rc-package-assets.test.mjs
```

The platform regression tests cover WebP-over-master selection, confirmed PNG
branding, music/fonts, missing-resource fail-closed behavior, output isolation,
and platform adapter separation.

## VK Hosting: optional split-audio package

The default `npm run build:vk` continues to bundle all eight OGG files for local
smoke testing and self-hosting. The official VK static host does not accept
audio files, so a second *explicitly selected* build profile is available:

```sh
# Set VK_AUDIO_BASE_URL to an actual, owner-approved, HTTPS directory URL
# ending with / which contains the 8 OGG files (never a token-bearing URL).
npm run build:vk:hosting
npm run vk:hosting:audit
```

This profile excludes the eight OGG tracks from `dist/vk` and injects the
external audio base URL into the VK-only module `src/vk-audio-config.js`.
The source module defaults to a relative local path, so Yandex and ordinary
VK builds are unchanged. The schema-2 build manifest records
`externalAudio.baseUrl` and the SHA-256 of every original OGG.
The audit checks all eight remote OGG URLs when using `--url`; a local
PASS alone is **not** proof of externally hosted audio.

The OGG bytes are not modified, transcoded, deleted from the repository,
or uploaded by the build step. Provisioning a public HTTPS audio host, paying
for storage, permitting anonymous reads, and changing any VK Developer Console
URL require separate owner authorization.

The build must be regenerated at its final HEAD and hash verified after a
real audio host is approved. External audio in VK Web/Android/iOS and OK
Web/Android/iOS remains pending real-client playback testing. Run default
`npm run build:vk` to restore the local all-assets bundle.
