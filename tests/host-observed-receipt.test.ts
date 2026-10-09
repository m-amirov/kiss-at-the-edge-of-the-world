import { createHash } from "node:crypto";
import { expect, test } from "bun:test";
import { createHostObservedReceipt } from "../src/adapters/chatgpt-web/host-observed-receipt";

const image = Buffer.from("S38 390x844 fixture", "utf8");
const sha256 = createHash("sha256").update(image).digest("hex");
const context = {
  sourceHead: "a".repeat(40),
  scene: "S38",
  viewport: "390x844",
  attachments: [{ ref: "codex-input-image-1", bytes: image.length, sha256 }],
};

test("host-observed receipt binds declared scene evidence to local bytes and a browser turn without provider IDs", () => {
  const receipt = createHostObservedReceipt({
    context,
    traceId: "trace_s38_01",
    assistantTurnIdentity: "group:assistant:browser-turn-1",
    requestedModel: "chatgpt-web/gpt-6-sol",
    reasoning: "high",
    attachments: [{ ref: "codex-input-image-1", buffer: image }],
    answer: "Visual-only review complete.",
  });

  expect(receipt.assurance).toBe("host-observed");
  expect(receipt.providerAttested).toBeFalse();
  expect(receipt.provider).toEqual({ taskId: null, responseId: null, reviewTraceId: null });
  expect(receipt.source).toEqual(context);
  expect(receipt.browser.assistantTurnIdentity).toBe("group:assistant:browser-turn-1");
  expect(receipt.answer.sha256).toBe(createHash("sha256").update("Visual-only review complete.").digest("hex"));
});

test("host-observed receipt refuses a missing, extra, or altered local attachment", () => {
  expect(() => createHostObservedReceipt({
    context,
    traceId: "trace_s38_01",
    assistantTurnIdentity: "browser-turn-1",
    requestedModel: "chatgpt-web/gpt-6-sol",
    attachments: [],
    answer: "answer",
  })).toThrow("attachment count");

  expect(() => createHostObservedReceipt({
    context,
    traceId: "trace_s38_01",
    assistantTurnIdentity: "browser-turn-1",
    requestedModel: "chatgpt-web/gpt-6-sol",
    attachments: [{ ref: "codex-input-image-1", buffer: Buffer.from("altered", "utf8") }],
    answer: "answer",
  })).toThrow("bytes do not match");
});

test("host-observed receipt rejects malformed source bindings and duplicate refs", () => {
  expect(() => createHostObservedReceipt({
    context: { ...context, sourceHead: "not-a-git-head" },
    traceId: "trace_s38_01",
    assistantTurnIdentity: "browser-turn-1",
    requestedModel: "chatgpt-web/gpt-6-sol",
    attachments: [{ ref: "codex-input-image-1", buffer: image }],
    answer: "answer",
  })).toThrow("invalid source");

  expect(() => createHostObservedReceipt({
    context: { ...context, attachments: [context.attachments[0]!, context.attachments[0]!] },
    traceId: "trace_s38_01",
    assistantTurnIdentity: "browser-turn-1",
    requestedModel: "chatgpt-web/gpt-6-sol",
    attachments: [{ ref: "codex-input-image-1", buffer: image }, { ref: "codex-input-image-1", buffer: image }],
    answer: "answer",
  })).toThrow("duplicate");
});
