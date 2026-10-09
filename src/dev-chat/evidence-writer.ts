import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

export interface EvidenceWriter {
  outputPath: string;
  receiptPath: string;
  persistReceipt: (payload: unknown) => void;
  persistFinal: (payload: unknown) => void;
}

function atomicJson(file: string, payload: unknown): void {
  const temp = file + ".tmp-" + process.pid + "-" + Math.random().toString(36).slice(2);
  let fd: number | undefined;
  try {
    fd = openSync(temp, "wx", 0o600);
    const bytes = Buffer.from(JSON.stringify(payload, null, 2) + "\n", "utf8");
    let written = 0;
    while (written < bytes.length) written += writeSync(fd, bytes, written, bytes.length - written);
    fsyncSync(fd);
    closeSync(fd);
    fd = undefined;
    renameSync(temp, file);
  } finally {
    if (fd !== undefined) closeSync(fd);
    rmSync(temp, { force: true });
  }
}

/**
 * Preflight the evidence sink before launching a browser turn.
 * An authentic receipt is persisted synchronously in a dedicated sidecar at
 * onReceipt time, before final response formatting or downstream Git checks.
 * Never overwrite an earlier attempt: use a distinct output path for retries.
 */
export function prepareEvidenceWriter(output: string): EvidenceWriter {
  if (!isAbsolute(output)) throw new Error("Evidence output must be an absolute path; relative CWD-dependent paths are forbidden");
  const outputPath = resolve(output);
  const receiptPath = outputPath + ".receipt.json";
  const parent = dirname(outputPath);
  mkdirSync(parent, { recursive: true });
  if (existsSync(outputPath) || existsSync(receiptPath))
    throw new Error("Evidence output exists; refusing to overwrite an earlier Web turn: " + outputPath);
  // Confirm actual write permission before consuming a live Web turn.
  const preflight = outputPath + ".preflight-" + process.pid;
  const fd = openSync(preflight, "wx", 0o600);
  try { writeSync(fd, "preflight\n"); fsyncSync(fd); }
  finally { closeSync(fd); rmSync(preflight, { force: true }); }
  let receiptSaved = false;
  return {
    outputPath,
    receiptPath,
    persistReceipt(payload) {
      if (receiptSaved) throw new Error("Attempted to overwrite the first observed browser receipt");
      atomicJson(receiptPath, payload);
      receiptSaved = true;
    },
    persistFinal(payload) {
      if (!receiptSaved) throw new Error("Cannot commit final evidence without a persisted browser receipt");
      if (existsSync(outputPath)) throw new Error("Final evidence output already exists");
      atomicJson(outputPath, payload);
    },
  };
}
