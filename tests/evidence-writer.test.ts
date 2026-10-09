import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prepareEvidenceWriter } from "../src/dev-chat/evidence-writer";

function temporaryOutput() {
  const folder = mkdtempSync(join(tmpdir(), "receipt-writer-not-a-git-repo-"));
  return { folder, file: join(folder, "batch1-role1.json") };
}

test("writer preflights an absolute sink outside Git before a browser call", () => {
  const { folder, file } = temporaryOutput();
  try {
    const writer = prepareEvidenceWriter(file);
    expect(existsSync(file)).toBeFalse();
    expect(existsSync(writer.receiptPath)).toBeFalse();
    writer.persistReceipt({ response: { text: "actually observed" }, providerAttested: false });
    expect(existsSync(writer.receiptPath)).toBeTrue();
    expect(JSON.parse(readFileSync(writer.receiptPath, "utf8")).response.text).toBe("actually observed");
    // A failure in unrelated postprocessing MUST NOT remove the raw receipt.
    expect(() => { throw new Error("git rev-parse HEAD: not a git repository"); }).toThrow("not a git repository");
    expect(existsSync(writer.receiptPath)).toBeTrue();
    writer.persistFinal({ status: "captured", receiptFile: writer.receiptPath });
    expect(JSON.parse(readFileSync(file, "utf8")).status).toBe("captured");
  } finally { rmSync(folder, { recursive: true, force: true }); }
});

test("writer does not permit overwrite, fabricated final receipt or CWD-dependent output", () => {
  const { folder, file } = temporaryOutput();
  try {
    expect(() => prepareEvidenceWriter("relative/out.json")).toThrow("absolute path");
    const writer = prepareEvidenceWriter(file);
    expect(() => writer.persistFinal({ status: "PASS" })).toThrow("without a persisted browser receipt");
    writer.persistReceipt({ traceId: "real-bridge-trace" });
    expect(() => writer.persistReceipt({ traceId: "another" })).toThrow("overwrite");
    expect(() => prepareEvidenceWriter(file)).toThrow("refusing to overwrite");
    writer.persistFinal({ ok: true });
    expect(() => prepareEvidenceWriter(file)).toThrow("refusing to overwrite");
    expect(() => writer.persistFinal({ ok: false })).toThrow("already exists");
  } finally { rmSync(folder, { recursive: true, force: true }); }
});

test("writer fails preflight when a complete output already exists", () => {
  const { folder, file } = temporaryOutput();
  try {
    writeFileSync(file, "prior attempt");
    expect(() => prepareEvidenceWriter(file)).toThrow("refusing to overwrite");
    expect(readFileSync(file, "utf8")).toBe("prior attempt");
  } finally { rmSync(folder, { recursive: true, force: true }); }
});
