"""Bounded ACE-Step 1.5 local generation client.

This intentionally uses DiT-only mode so a 4GB-class CUDA GPU does not need an
LM checkpoint. The project JSON is the only source of prompts and seeds.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import soundfile as sf


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--cue", required=True)
    parser.add_argument("--candidates", type=int, default=1)
    parser.add_argument("--repair", action="store_true")
    parser.add_argument("--device", default=os.environ.get("ACE_STEP_DEVICE", "cpu"), choices=["cpu", "cuda"])
    args = parser.parse_args()
    if args.candidates < 1 or args.candidates > 3:
        raise SystemExit("candidate count must be 1..3")

    root = Path(__file__).resolve().parents[2]
    config = json.loads((root / "config/music-cues.json").read_text(encoding="utf-8"))
    cue = next((item for item in config["cues"] if item["cueId"] == args.cue), None)
    if cue is None:
        raise SystemExit(f"unknown cue: {args.cue}")

    ace_root = Path(os.environ.get("ACE_STEP_ROOT", r"E:\AI\ACE-Step-1.5"))
    candidate_root = Path(os.environ.get("AUDIO_CANDIDATE_ROOT", r"E:\AI\kiss-at-the-edge-of-the-world-audio-candidates"))
    project_root = Path(os.environ.get("ACE_STEP_PROJECT_ROOT", r"E:\AI\ACE-Step-runtime"))
    candidate_dir = candidate_root / cue["cueId"]
    candidate_dir.mkdir(parents=True, exist_ok=True)
    project_root.mkdir(parents=True, exist_ok=True)

    if str(ace_root) not in sys.path:
        sys.path.insert(0, str(ace_root))
    from acestep.handler import AceStepHandler
    from acestep.inference import GenerationConfig, GenerationParams, generate_music

    handler = AceStepHandler()
    use_cuda = args.device == "cuda"
    status = handler.initialize_service(
        project_root=str(project_root),
        config_path="acestep-v15-turbo",
        device=args.device,
        offload_to_cpu=use_cuda,
        offload_dit_to_cpu=use_cuda,
        quantization=None,
        use_flash_attention=False,
    )
    print(f"ACE-Step init: {status}")
    if not status[1]:
        raise SystemExit(status[0])

    seeds = [cue["seed"] + index for index in range(args.candidates)]
    params = GenerationParams(
        task_type="text2music",
        caption=cue["prompt"],
        lyrics="[Instrumental]",
        instrumental=True,
        bpm=cue["tempoBpm"],
        duration=cue["durationSeconds"],
        inference_steps=8,
        seed=cue["seed"],
        thinking=False,
        use_cot_metas=False,
        use_cot_caption=False,
        use_cot_language=False,
        use_constrained_decoding=False,
        shift=3.0,
    )
    generation = GenerationConfig(
        batch_size=args.candidates,
        use_random_seed=False,
        seeds=seeds,
        audio_format="wav",
    )
    result = generate_music(handler, None, params, generation, save_dir=str(candidate_dir))
    if not result.success:
        raise SystemExit(result.error or result.status_message)

    metadata = {
        "cueId": cue["cueId"],
        "generator": config["generator"],
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "repair": bool(args.repair),
        "candidates": [],
    }
    for index, audio in enumerate(result.audios, start=1):
        source = Path(audio["path"])
        target = candidate_dir / f"candidate-{index:02d}.wav"
        if source.resolve() != target.resolve():
            source.replace(target)
        samples, sample_rate = sf.read(target, always_2d=True, dtype="float32")
        if not np.isfinite(samples).all():
            raise SystemExit(f"non-finite audio rejected: {target}")
        metadata["candidates"].append({
            "candidate": index,
            "seed": seeds[index - 1],
            "path": str(target),
            "sha256": sha256(target),
            "sampleRate": sample_rate,
            "params": audio.get("params", {}),
        })
    (candidate_dir / "candidates.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(metadata, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
