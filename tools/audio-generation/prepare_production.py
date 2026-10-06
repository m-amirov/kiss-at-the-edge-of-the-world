"""Prepare a selected WAV as a normalized browser-ready OGG Vorbis asset."""
from __future__ import annotations
import argparse, hashlib, json, shutil, subprocess
from pathlib import Path
import soundfile as sf
import numpy as np

def sha256(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''): h.update(chunk)
    return h.hexdigest()

def main():
    p = argparse.ArgumentParser(); p.add_argument('--cue', required=True); p.add_argument('--input', required=True); p.add_argument('--output-root', default=None); args = p.parse_args()
    root = Path(__file__).resolve().parents[2]; cue = next(c for c in json.loads((root/'config/music-cues.json').read_text(encoding='utf8'))['cues'] if c['cueId']==args.cue)
    source = Path(args.input); output = root/'assets/audio/music'/f'{cue["cueId"]}.ogg'; output.parent.mkdir(parents=True, exist_ok=True)
    data, rate = sf.read(source, always_2d=True, dtype='float32');
    if not data.size or not np.isfinite(data).all(): raise SystemExit('source contains no samples or non-finite samples')
    peak = float(np.max(np.abs(data))) if data.size else 0.0
    if rate != 48000: raise SystemExit(f'expected 48000 Hz source, got {rate}')
    if peak <= 0.0001: raise SystemExit('source is silent')
    if peak > 0.98: data = data * (0.92 / peak)
    temp = output.with_suffix('.normalized.wav'); sf.write(temp, data, rate, subtype='PCM_16')
    ffmpeg = shutil.which('ffmpeg')
    if not ffmpeg: raise SystemExit('ffmpeg is required for OGG production encoding')
    subprocess.run([ffmpeg, '-y', '-hide_banner', '-loglevel', 'error', '-i', str(temp), '-c:a', 'libvorbis', '-q:a', '4', str(output)], check=True)
    temp.unlink(missing_ok=True)
    info = {'cueId': cue['cueId'], 'sourceWav': f'external-candidate-root/{cue["cueId"]}/candidate-01.wav', 'sourceWavSha256': sha256(source), 'finalFile': str(output.relative_to(root)).replace('\\','/'), 'finalSha256': sha256(output), 'sampleRate': rate, 'channels': int(data.shape[1]), 'durationSeconds': round(len(data)/rate, 3), 'peak': round(float(np.max(np.abs(data))), 6), 'loopable': cue['loopable'], 'loopMetadata': {'runtimeLoop': cue['loopable'], 'seamReview': 'pending perceptual listening review'}, 'processing': 'finite-sample check; source silence policy; peak guard to -0.72 dBFS when needed; OGG Vorbis q4'}
    out = root/'artifacts/evidence'; out.mkdir(parents=True, exist_ok=True); (out/f'music-preparation-{cue["cueId"]}.json').write_text(json.dumps(info, ensure_ascii=False, indent=2), encoding='utf8'); print(json.dumps(info, ensure_ascii=False, indent=2))

if __name__ == '__main__': main()
