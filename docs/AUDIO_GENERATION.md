# Music generation and provenance

The soundtrack is generated locally with ACE-Step 1.5 and is not produced by a paid API. The generator repository and model cache stay outside this project and are never included in the browser package.

## Locked upstream

- Repository: [ACE-Step](https://github.com/ace-step/ACE-Step)
- Revision: `dce621408bee8c31b4fcf4811682eb9359e1bc94` (`v0.1.8`)
- Model: `ACE-Step/Ace-Step1.5`, recommended `acestep-v15-turbo` DiT-only checkpoint
- Code license: [MIT](https://github.com/ace-step/ACE-Step/blob/main/LICENSE)
- Model license and commercial-output statement: [official model card](https://huggingface.co/ACE-Step/Ace-Step1.5)
- Official API reference: [inference API](https://github.com/ace-step/ACE-Step/blob/main/docs/inference_api.md)

## Reproducible local flow

1. Install the pinned ACE-Step checkout into an isolated Python 3.11 environment outside the project.
2. Run `npm run audio:check` to verify the external checkout, Python runtime and torch backend.
3. Run `npm run audio:build-cues` to regenerate `src/music-cues.js` from `config/music-cues.json`.
4. Run the generator once per cue with `tools/audio-generation/generate_candidates.py`. The checked-in spec fixes the seed, prompt, duration, instrumental mode, inference steps and turbo shift. Candidate WAV files and model weights remain external.
5. Run `tools/audio-generation/prepare_production.py` for the selected candidate. It rejects non-finite or silent samples, applies the peak guard, and encodes OGG Vorbis q4 into `assets/audio/music/`.
6. Run `tools/audio-generation/update-asset-manifests.mjs` when adding a new cue set.

The current production run uses the official CPU backend. CUDA was detected on the local GTX 1660 SUPER, but ACE-Step v0.1.8 FP16 output was rejected after a finite-sample check produced an all-NaN WAV; the float32 workaround did not fit the available VRAM. No cloud fallback is used.

The canonical machine-readable soundtrack contract is `config/music-cues.json`. Final hashes, processing metadata and source-free provenance are generated under `artifacts/evidence/music-provenance.json`; that evidence is intentionally not part of the browser release package.
