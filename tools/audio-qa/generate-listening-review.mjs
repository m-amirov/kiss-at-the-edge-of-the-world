import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { musicCues } from '../../src/music-cues.js';

const run = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const audioRoot = path.join(root, 'assets/audio/music');
const evidenceRoot = path.join(root, 'artifacts/evidence');
const sourceHead = (await run('git', ['rev-parse', 'HEAD'], { cwd: root })).stdout.trim();
const expectedHead = 'ff9394433445856c951f19484a5139dc47d951aa';

if (sourceHead !== expectedHead) {
  throw new Error(`AUDIO_SOURCE_HEAD_MISMATCH: expected ${expectedHead}, got ${sourceHead}`);
}

async function sha256(file) {
  const hash = createHash('sha256');
  hash.update(await fs.readFile(file));
  return hash.digest('hex');
}

async function probe(file) {
  const { stdout } = await run('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration,size:stream=index,codec_name,codec_type,channels,sample_rate',
    '-of', 'json', file
  ]);
  const data = JSON.parse(stdout);
  const stream = data.streams.find(item => item.codec_type === 'audio');
  if (!stream) throw new Error(`DECODE_ERROR: no audio stream in ${file}`);
  return {
    codec: stream.codec_name,
    channels: Number(stream.channels),
    sampleRate: Number(stream.sample_rate),
    durationSeconds: Number(data.format.duration),
    fileSizeBytes: Number(data.format.size)
  };
}

async function loudness(file) {
  try {
    const { stderr } = await run('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-filter_complex', 'ebur128=framelog=verbose', '-f', 'null', '-'], { maxBuffer: 2 * 1024 * 1024 });
    const integrated = [...stderr.matchAll(/\bI:\s*(-?\d+(?:\.\d+)?)\s*LUFS/g)].map(match => Number(match[1])).at(-1) ?? null;
    const truePeak = [...stderr.matchAll(/\bTP:\s*(-?\d+(?:\.\d+)?)\s*dBFS/g)].map(match => Number(match[1])).at(-1) ?? null;
    return { integratedLufs: integrated, truePeakDbfs: truePeak, supported: integrated !== null || truePeak !== null };
  } catch {
    return { integratedLufs: null, truePeakDbfs: null, supported: false };
  }
}

async function peak(file) {
  try {
    const { stderr } = await run('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'astats=metadata=1:reset=0', '-f', 'null', '-'], { maxBuffer: 2 * 1024 * 1024 });
    const values = [...stderr.matchAll(/Peak level dB:\s*(-?\d+(?:\.\d+)?)/g)].map(match => Number(match[1]));
    return values.length ? Math.max(...values) : null;
  } catch {
    return null;
  }
}

async function silenceEdges(file) {
  try {
    const { stderr } = await run('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'silencedetect=noise=-60dB:d=0.05', '-f', 'null', '-'], { maxBuffer: 2 * 1024 * 1024 });
    const starts = [...stderr.matchAll(/silence_start:\s*(-?\d+(?:\.\d+)?)/g)].map(match => Number(match[1]));
    const ends = [...stderr.matchAll(/silence_end:\s*(-?\d+(?:\.\d+)?)/g)].map(match => Number(match[1]));
    return { supported: true, leadingSilenceSeconds: starts[0] === 0 ? (ends[0] ?? 0) : 0, trailingSilenceSeconds: ends.length && starts.length && starts.at(-1) > 0 ? Math.max(0, (ends.at(-1) ?? starts.at(-1)) - starts.at(-1)) : 0, thresholdDbfs: -60, minimumDurationSeconds: 0.05 };
  } catch (error) {
    return { supported: false, error: error.message };
  }
}

async function boundary(file, duration, loopable) {
  if (!loopable) return { applicable: false, status: 'NOT_APPLICABLE' };
  try {
    const { stdout } = await run('ffmpeg', [
      '-v', 'error', '-i', file, '-filter:a', 'atrim=start=0:end=0.05,asetpts=PTS-STARTPTS', '-f', 'f32le', 'pipe:1'
    ], { encoding: 'buffer', maxBuffer: 2 * 1024 * 1024 });
    const first = new Float32Array(stdout.buffer, stdout.byteOffset, Math.floor(stdout.byteLength / 4));
    const { stdout: end } = await run('ffmpeg', [
      '-v', 'error', '-ss', String(Math.max(0, duration - 0.05)), '-i', file, '-filter:a', 'asetpts=PTS-STARTPTS', '-f', 'f32le', 'pipe:1'
    ], { encoding: 'buffer', maxBuffer: 2 * 1024 * 1024 });
    const last = new Float32Array(end.buffer, end.byteOffset, Math.floor(end.byteLength / 4));
    const endSample = last.length ? last[last.length - 1] : null;
    const startSample = first.length ? first[0] : null;
    return { applicable: true, status: 'ADVISORY', firstSample: startSample, lastSample: endSample, amplitudeDiscontinuity: startSample !== null && endSample !== null ? Math.abs(startSample - endSample) : null, spectralDiscontinuity: 'NOT_COMPUTED' };
  } catch (error) {
    return { applicable: true, status: 'UNAVAILABLE', error: error.message };
  }
}

const tracks = [];
for (const cue of musicCues) {
  const file = path.join(audioRoot, `${cue.cueId}.ogg`);
  const technical = await probe(file);
  tracks.push({
    cueId: cue.cueId,
    path: `assets/audio/music/${cue.cueId}.ogg`,
    durationSeconds: technical.durationSeconds,
    declaredDurationSeconds: cue.durationSeconds,
    loopable: cue.loopable,
    sha256: await sha256(file),
    targetSceneFamilies: cue.sceneFamilies,
    sampleScenes: cue.sceneIds,
    nominalVolume: 0.28,
    crossfade: { durationMs: 260, curve: 'linear', implementation: 'src/audio-director.js' },
    technical: { ...technical, peakDbfs: await peak(file), ...(await loudness(file)), decodeErrors: false, silenceAtBeginningEnd: await silenceEdges(file), loopBoundary: await boundary(file, technical.durationSeconds, cue.loopable) }
  });
}

const generatedAt = new Date().toISOString();
const technicalReport = { schemaVersion: 1, status: 'TECHNICAL_REPORT_ONLY', generatedAt, testedSourceHead: sourceHead, expectedCues: musicCues.map(cue => cue.cueId), tracks };
const template = {
  schemaVersion: 1,
  status: 'PENDING_HUMAN_REVIEW',
  testedSourceHead: sourceHead,
  generatedAt,
  instructions: 'Human listening is required. Do not infer PASS from technical metrics. Mark every cue and every applicable scenario explicitly.',
  allowedVerdicts: ['PASS', 'REPAIR'],
  allowedRepairReasons: ['WRONG_MOOD', 'TOO_REPETITIVE', 'AI_ARTIFACT', 'BAD_LOOP', 'TOO_LOUD', 'TOO_QUIET', 'DIALOGUE_MASKING', 'BAD_TRANSITION', 'GENERIC_STOCK_FEEL', 'OTHER'],
  volumePresets: [1, 0.75, 0.5, 0.25, 0],
  cues: musicCues.map(cue => ({ cueId: cue.cueId, verdict: null, compositionFit: null, moodFit: null, repetitiveness: null, aiArtifacts: null, loopSeam: cue.loopable ? null : 'NOT_APPLICABLE', volume: null, dialogueMasking: null, transitionQuality: null, notes: '', repairReason: '', sampleScenes: cue.sceneIds })),
  transitions: [
    ['main-theme', 'road'], ['road', 'cafe'], ['cafe', 'romantic'], ['romantic', 'tension'], ['tension', 'sad'], ['sad', 'ending']
  ].map(([from, to]) => ({ from, to, verdict: null, crossfadeDurationMs: 260, notes: '' })),
  scenarios: {
    back: { verdict: null, notes: '' },
    saveReload: { verdict: null, notes: '' },
    localeSwitchRuEn: { verdict: null, notes: '' }
  }
};
await fs.mkdir(evidenceRoot, { recursive: true });
await fs.writeFile(path.join(evidenceRoot, 'audio-listening-technical.json'), `${JSON.stringify(technicalReport, null, 2)}\n`);
await fs.writeFile(path.join(evidenceRoot, 'audio-listening-review-template.json'), `${JSON.stringify(template, null, 2)}\n`);
console.log(JSON.stringify({ status: 'READY_FOR_HUMAN_AUDIO_LISTENING_REVIEW', testedSourceHead: sourceHead, tracks: tracks.map(track => ({ cueId: track.cueId, durationSeconds: track.durationSeconds, sha256: track.sha256, loopable: track.loopable })), technicalReport: 'artifacts/evidence/audio-listening-technical.json', reviewTemplate: 'artifacts/evidence/audio-listening-review-template.json' }, null, 2));
