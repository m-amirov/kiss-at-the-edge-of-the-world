import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '../..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'config/music-cues.json'), 'utf8'));
const candidateRoot = process.env.ACE_STEP_CANDIDATE_ROOT;
if (!candidateRoot) throw new Error('ACE_STEP_CANDIDATE_ROOT is required and must point outside the project');
const sourceHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();

const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const tracks = config.cues.map((cue) => {
  const source = path.join(candidateRoot, cue.cueId, 'candidate-01.wav');
  const final = path.join(root, 'assets/audio/music', `${cue.cueId}.ogg`);
  const prep = JSON.parse(fs.readFileSync(path.join(root, 'artifacts/evidence', `music-preparation-${cue.cueId}.json`), 'utf8'));
  return {
    cueId: cue.cueId,
    purpose: cue.purpose,
    sceneIds: cue.sceneIds,
    prompt: cue.prompt,
    negativePrompt: cue.negativePrompt,
    seed: cue.seed,
    generationParameters: { durationSeconds: cue.durationSeconds, instrumental: true, inferenceSteps: 8, shift: 3, backend: 'cpu', mode: 'DiT-only' },
    generator: { name: 'ACE-Step 1.5', release: 'v0.1.8', revision: 'dce621408bee8c31b4fcf4811682eb9359e1bc94', model: 'ACE-Step/Ace-Step1.5::acestep-v15-turbo', upstream: 'https://github.com/ace-step/ACE-Step', modelCard: 'https://huggingface.co/ACE-Step/Ace-Step1.5', license: 'MIT; official model card permits commercial use of generated music' },
    sourceWav: { identity: `external-candidate-root/${cue.cueId}/candidate-01.wav`, sha256: sha256(source) },
    finalAsset: { path: `assets/audio/music/${cue.cueId}.ogg`, sha256: sha256(final), durationSeconds: prep.durationSeconds, sampleRate: prep.sampleRate, channels: prep.channels, peak: prep.peak },
    loop: { enabled: cue.loopable, runtime: cue.loopable, seamReview: 'pending perceptual listening review' },
    processing: prep.processing
  };
});

const evidence = { schemaVersion: 1, sourceHead, generatedAt: new Date().toISOString(), generatorPolicy: config.generationPolicy, tracks };
const out = path.join(root, 'artifacts/evidence');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'music-provenance.json'), `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
console.log(`Wrote provenance for ${tracks.length} tracks at source HEAD ${sourceHead}.`);
