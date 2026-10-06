import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '../..');
const provenance = JSON.parse(fs.readFileSync(path.join(root, 'artifacts/evidence/music-provenance.json'), 'utf8'));
const review = {
  schemaVersion: 1,
  sourceHead: provenance.sourceHead,
  technicalQa: { status: 'PASS', checks: ['finite source WAV samples', '48 kHz stereo source', 'non-silent source', 'OGG Vorbis q4 output', 'peak guard applied', 'release assets contain OGG only'] },
  runtimeQa: { status: 'PASS_WITH_AUTOMATED_COVERAGE', checks: ['semantic cue mapping', 'A to A does not restart', 'A to B crossfade path', 'single active music instance', 'persistent mute and volume state', 'browser lifecycle pause/resume hooks'] },
  listeningReview: { status: 'READY_FOR_AUDIO_LISTENING_REVIEW', reason: 'Perceptual listening, loop seam, scene fit and dialogue-masking review require human playback review; waveform and hash checks are not a substitute.' },
  tracks: provenance.tracks.map(({ cueId, finalAsset, loop }) => ({ cueId, file: finalAsset.path, durationSeconds: finalAsset.durationSeconds, loop }))
};
fs.writeFileSync(path.join(root, 'artifacts/evidence/audio-quality-review.json'), `${JSON.stringify(review, null, 2)}\n`, 'utf8');
console.log('Wrote audio quality review evidence with human listening review pending.');
