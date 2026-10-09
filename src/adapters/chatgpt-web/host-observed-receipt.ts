import { createHash } from "node:crypto";

export interface HostObservedReceiptContext {
  sourceHead: string;
  scene: string;
  viewport: string;
  attachments: ReadonlyArray<{ ref: string; sha256: string; bytes: number }>;
}

export interface HostObservedReceipt {
  schema: "codex.web.host-observed-receipt.v1";
  assurance: "host-observed";
  providerAttested: false;
  provider: { taskId: null; responseId: null; reviewTraceId: null };
  source: HostObservedReceiptContext;
  browser: {
    bridgeTraceId: string;
    assistantTurnIdentity: string;
    userTurnIdentity: string | null;
    submission: "tile-visible-and-send-enabled";
    submissionEvidence: string | null;
    completion: "stable-dom-completion-action";
  };
  route: {
    requestedModel: string;
    selectedModel: string | null;
    reasoning: string | null;
    selectedReasoning: string | null;
  };
  answer: { sha256: string; text?: string };
}

export interface ObservedBrowserAttachment {
  ref: string;
  buffer: Buffer;
}

const SHA256 = /^[a-f0-9]{64}$/i;
const SOURCE_HEAD = /^[a-f0-9]{40}$/i;
const ID = /^[A-Za-z0-9_.:-]{1,128}$/;
const VIEWPORT = /^(?:\d{2,5}x\d{2,5}|multi)$/;

function requireContext(context: HostObservedReceiptContext): void {
  if (!SOURCE_HEAD.test(context.sourceHead) || !ID.test(context.scene) || !VIEWPORT.test(context.viewport)) {
    throw new Error("Host-observed receipt context has an invalid source, scene, or viewport binding");
  }
  const refs = new Set<string>();
  for (const attachment of context.attachments) {
    if (!attachment || !ID.test(attachment.ref) || !SHA256.test(attachment.sha256)
      || !Number.isSafeInteger(attachment.bytes) || attachment.bytes < 1 || refs.has(attachment.ref)) {
      throw new Error("Host-observed receipt context has an invalid or duplicate attachment binding");
    }
    refs.add(attachment.ref);
  }
}

export function parseHostObservedReceiptContext(value: unknown): HostObservedReceiptContext {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Host-observed receipt context is not an object");
  }
  const context = value as Partial<HostObservedReceiptContext>;
  if (!Array.isArray(context.attachments)) throw new Error("Host-observed receipt context attachments are invalid");
  const parsed: HostObservedReceiptContext = {
    sourceHead: String(context.sourceHead ?? ""),
    scene: String(context.scene ?? ""),
    viewport: String(context.viewport ?? ""),
    attachments: context.attachments.map(attachment => {
      const item = attachment as Partial<HostObservedReceiptContext["attachments"][number]>;
      return { ref: String(item?.ref ?? ""), sha256: String(item?.sha256 ?? ""), bytes: Number(item?.bytes) };
    }),
  };
  requireContext(parsed);
  return parsed;
}

export function parseHostObservedReceipt(value: unknown): HostObservedReceipt {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Host-observed receipt is not an object");
  const receipt = value as Partial<HostObservedReceipt>;
  const context = parseHostObservedReceiptContext(receipt.source);
  if (receipt.schema !== "codex.web.host-observed-receipt.v1" || receipt.assurance !== "host-observed"
    || receipt.providerAttested !== false || receipt.provider?.taskId !== null || receipt.provider?.responseId !== null
    || receipt.provider?.reviewTraceId !== null || !receipt.browser || !ID.test(receipt.browser.bridgeTraceId)
    || !receipt.browser.assistantTurnIdentity || receipt.browser.submission !== "tile-visible-and-send-enabled"
    || receipt.browser.completion !== "stable-dom-completion-action" || !receipt.route?.requestedModel
    || (receipt.route.selectedModel !== null && typeof receipt.route.selectedModel !== "string")
    || (receipt.route.reasoning !== null && typeof receipt.route.reasoning !== "string")
    || (receipt.route.selectedReasoning !== null && typeof receipt.route.selectedReasoning !== "string")
    || !receipt.answer || !SHA256.test(receipt.answer.sha256)
    || (receipt.answer.text !== undefined && typeof receipt.answer.text !== "string")
    || (typeof receipt.answer.text === "string"
      && createHash("sha256").update(receipt.answer.text).digest("hex") !== receipt.answer.sha256)) {
    throw new Error("Host-observed receipt payload is invalid");
  }
  return {
    schema: receipt.schema,
    assurance: receipt.assurance,
    providerAttested: false,
    provider: { taskId: null, responseId: null, reviewTraceId: null },
    source: context,
    browser: receipt.browser,
    route: receipt.route,
    answer: receipt.answer,
  };
}

/**
 * This is intentionally not a provider receipt. It binds caller-supplied local provenance to
 * the exact bytes visible in ChatGPT's composer and to the DOM turn that reached stable completion.
 */
export function createHostObservedReceipt({
  context,
  traceId,
  assistantTurnIdentity,
  userTurnIdentity,
  requestedModel,
  selectedModel,
  reasoning,
  selectedReasoning,
  submissionEvidence,
  attachments,
  answer,
}: {
  context: HostObservedReceiptContext;
  traceId: string;
  assistantTurnIdentity: string;
  userTurnIdentity?: string | null;
  requestedModel: string;
  selectedModel?: string;
  reasoning?: string;
  selectedReasoning?: string;
  submissionEvidence?: string;
  attachments: readonly ObservedBrowserAttachment[];
  answer: string;
}): HostObservedReceipt {
  requireContext(context);
  if (!ID.test(traceId) || !assistantTurnIdentity || !requestedModel || new Set(attachments.map(item => item.ref)).size !== attachments.length) {
    throw new Error("Host-observed receipt has an invalid browser turn binding");
  }
  if (attachments.length !== context.attachments.length) {
    throw new Error("Host-observed receipt attachment count does not match the declared local evidence");
  }
  for (const attachment of attachments) {
    const declared = context.attachments.find(item => item.ref === attachment.ref);
    const actualSha256 = createHash("sha256").update(attachment.buffer).digest("hex");
    if (!declared || declared.bytes !== attachment.buffer.length || declared.sha256.toLowerCase() !== actualSha256) {
      throw new Error("Host-observed receipt attachment bytes do not match the declared local evidence");
    }
  }
  return {
    schema: "codex.web.host-observed-receipt.v1",
    assurance: "host-observed",
    providerAttested: false,
    provider: { taskId: null, responseId: null, reviewTraceId: null },
    source: { ...context, attachments: context.attachments.map(item => ({ ...item, sha256: item.sha256.toLowerCase() })) },
    browser: {
      bridgeTraceId: traceId,
      assistantTurnIdentity,
      userTurnIdentity: userTurnIdentity ?? null,
      submission: "tile-visible-and-send-enabled",
      submissionEvidence: submissionEvidence ?? null,
      completion: "stable-dom-completion-action",
    },
    route: {
      requestedModel,
      selectedModel: selectedModel ?? null,
      reasoning: reasoning ?? null,
      selectedReasoning: selectedReasoning ?? null,
    },
    answer: { sha256: createHash("sha256").update(answer).digest("hex"), text: answer },
  };
}
