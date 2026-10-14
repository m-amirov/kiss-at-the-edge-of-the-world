import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { productSnapshot, repositoryIdentity, verifyArtAcceptance } from './art-acceptance.mjs';
import { verifyVisualContentReviews } from './visual-content-review.mjs';

const root = process.cwd();
const arg = name => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const fail = message => { console.error(`ART_ACCEPTANCE_REFRESH_BLOCKED: ${message}`); process.exitCode = 2; };
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const rel = value => path.relative(root, value).replaceAll('\\', '/');
const absolute = value => path.resolve(root, value);
const readJson = file => JSON.parse(fs.readFileSync(absolute(file), 'utf8'));
const sourceHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const matrixPath = arg('--matrix');
const webPaths = (arg('--web-reviews') ?? '').split(';').map(item => item.trim()).filter(Boolean);
const outputPath = 'artifacts/evidence/production-art-acceptance.json';
const assurance = arg('--assurance') ?? 'strict';

if (!['strict','visual-content'].includes(assurance) || !matrixPath ||
    webPaths.length < 3 || (assurance === 'strict' && webPaths.length !== 3)) {
  fail('requires --matrix <json>, --assurance strict|visual-content and at least three semicolon-separated --web-reviews (exactly three in strict mode); no PASS record was created.');
} else {
  try {
    const matrix = readJson(matrixPath);
    if (matrix.status !== 'PASS' || matrix.sourceHead !== sourceHead || matrix.scope?.expectedScenes !== 66 || matrix.scope?.coveredScenes !== 66 || matrix.scope?.captures !== 198 || matrix.failures?.length) throw new Error('matrix is not a PASS 66-scene current-HEAD matrix');
    const reviews = webPaths.map(file => ({ path: file, sha256: sha256(absolute(file)), evidence: readJson(file) }));
    const requiredRoles = new Set(['ceos_reasoner_web', 'ceos_bulk_checker_web', 'ceos_art_director_web']);
    for (const review of reviews) {
      if (!requiredRoles.has(review.evidence.role ?? review.evidence.agent) || review.evidence.status !== 'PASS' ||
          review.evidence.sourceHead !== sourceHead || review.evidence.actualPixelsReceived !== true ||
          (assurance === 'strict' && (!review.evidence.taskId || !review.evidence.reviewTraceId)))
        throw new Error(`invalid Web review: ${review.path}`);
    }
    if (new Set(reviews.map(item => item.evidence.role ?? item.evidence.agent)).size !== 3)
      throw new Error('Web reviews must contain all three required roles');
    if (assurance === 'visual-content') {
      const checked = verifyVisualContentReviews({
        projectRoot: root, matrix, sourceHead,
        reviewEntries: reviews.map(review => ({
          reference: { path: review.path, sha256: review.sha256, role: review.evidence.role ?? review.evidence.agent },
          evidence: review.evidence
        }))
      });
      if (checked.status !== 'PASS') throw new Error(`${checked.code}: ${checked.reason}`);
    }

    const manifest = readJson('assets/asset-manifest.json');
    const manifestEntries = [...(manifest.assets ?? []), ...(manifest.previewAssets ?? [])];
    const accepted = new Map();
    const runtime = new Map();
    for (const scene of matrix.scenes) for (const capture of scene.captures) {
      if (!capture.manifest) throw new Error(`missing manifest mapping for ${scene.sceneId}/${scene.cue}`);
      const entry = manifestEntries.find(item => item.id === capture.manifest.id);
      if (!entry) throw new Error(`manifest entry missing: ${capture.manifest.id}`);
      for (const file of [entry.path, entry.portraitAsset].filter(Boolean)) {
        if (!fs.existsSync(absolute(file))) throw new Error(`physical source asset missing: ${file}`);
        accepted.set(file, { path: file, sha256: sha256(absolute(file)), manifestId: entry.id });
      }
      for (const file of [entry.runtimePath, entry.runtimePortraitAsset].filter(Boolean)) {
        if (!fs.existsSync(absolute(file))) throw new Error(`physical runtime asset missing: ${file}`);
        runtime.set(file, { path: file, sha256: sha256(absolute(file)), manifestId: entry.id });
      }
    }
    const manifestFile = 'assets/asset-manifest.json';
    const rightsFile = 'assets/provenance/rights-manifest.json';
    const snapshot = productSnapshot(root);
    const identity = repositoryIdentity(root);
    const record = {
      schemaVersion: assurance === 'visual-content' ? 4 : 3,
      ...(assurance === 'visual-content' ? { assurance } : {}),
      recordType: 'production-art-acceptance',
      status: 'PASS',
      verdict: 'PASS_PRODUCTION_ART_66_66',
      sourceProductHead: sourceHead,
      repository: { ...identity, sourceProductHead: sourceHead },
      sourceProductSnapshot: snapshot,
      acceptedSceneCoverage: { expected: 66, covered: 66, remaining: 0, matrix: rel(absolute(matrixPath)) },
      placeholders: 0,
      brokenPaths: 0,
      manifestSha256: sha256(absolute(manifestFile)),
      rightsManifestSha256: sha256(absolute(rightsFile)),
      acceptedAssets: [...accepted.values()],
      runtimeAssets: [...runtime.values()],
      webHigh: {
        ...(assurance === 'visual-content' ? { assurance } : {}), result: 'PASS',
        reviews: reviews.map(({ evidence, ...reference }) => ({
          ...reference, role: evidence.role ?? evidence.agent,
          taskId: evidence.taskId ?? null, reviewTraceId: evidence.reviewTraceId ?? null,
          actualPixelsReceived: true
        }))
      },
      evidence: { matrix: { path: rel(absolute(matrixPath)), sha256: sha256(absolute(matrixPath)), sourceHead } },
      compatibility: { status: 'PASS', result: 'CURRENT_SOURCE_SNAPSHOT_AND_HASHES_MATCH', manifestMappings: 'PASS', pngRegeneratedAfterAcceptance: false, coverageMethod: '66 authored scenes x 3 current browser viewports; backgrounds and dedicated CGs are accepted only at their authored cue/state' },
      runtimeVerification: { status: 'PASS', evidencePath: rel(absolute(matrixPath)), generatedAt: new Date().toISOString(), sourceHead, viewports: ['1920x900', '390x844', '360x640'], scenes: 66, captures: 198, consoleErrors: 0, failedRequests: 0, placeholders: 0, brokenPaths: 0 },
      verifier: { type: 'source-bound-production-art-verifier', source: 'tools/release/art-acceptance.mjs + current matrix + Web High review hashes', algorithm: 'sha256', acceptanceTimestamp: new Date().toISOString(), sourceProductHead: sourceHead },
    };
    const result = verifyArtAcceptance({ root, recordOverride: record });
    if (result.status !== 'PASS') throw new Error(`${result.code}: ${result.reason}`);
    const output = absolute(outputPath);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, `${JSON.stringify(record, null, 2)}\n`);
    console.log(JSON.stringify({ status: 'PASS', assurance, output: outputPath, sourceProductHead: sourceHead, acceptedAssets: accepted.size, runtimeAssets: runtime.size, webReviews: reviews.map(item => item.evidence.role ?? item.evidence.agent) }, null, 2));
  } catch (error) {
    fail(`${error.message}; no PASS record was created.`);
  }
}
