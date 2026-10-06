# Local music generation

The product runtime never imports ACE-Step. Generation is an isolated local
tooling step using the official ACE-Step 1.5 checkout and environment outside
this repository.

Expected local paths (override with environment variables):

- `ACE_STEP_ROOT`: `E:\AI\ACE-Step-1.5`
- `ACE_STEP_PYTHON`: `E:\AI\ACE-Step-1.5-venv311\Scripts\python.exe`
- `ACE_STEP_PROJECT_ROOT`: `E:\AI\ACE-Step-runtime`
- `AUDIO_CANDIDATE_ROOT`: `E:\AI\kiss-at-the-edge-of-the-world-audio-candidates`

Commands:

```powershell
npm run audio:check
npm run audio:build-cues
python tools/audio-generation/generate_candidates.py --cue main-theme --candidates 1
python tools/audio-generation/prepare_production.py --cue main-theme --input <candidate.wav>
```

The source WAV and model cache stay outside Git. Only selected browser-ready
assets, machine-readable specs, and source-bound provenance are tracked.
