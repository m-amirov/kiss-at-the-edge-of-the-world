import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { prepareEvidenceWriter } from "../src/dev-chat/evidence-writer";
import { loadConfig } from "../src/config";
import { createLauncherDevAdapter } from "../src/dev-chat/driver";
import { activateDevProfileEnvironment, resolveDevProfilePaths } from "../src/dev-chat/profile";
import { routeChatGptWebRequest } from "../src/server";
import { closeChatGptBrowserWorkers } from "../src/adapters/chatgpt-web/browser-worker";
import type { HostObservedReceipt, HostObservedReceiptContext } from "../src/adapters/chatgpt-web/host-observed-receipt";
import type { AdapterEvent, CodexParsedRequest, CodexProviderConfig } from "../src/types";

function option(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value || value.startsWith("--")) throw new Error(`${name} is required`);
  return value;
}

function optional(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function options(name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name) {
      const value = process.argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`);
      values.push(value);
      index += 1;
    }
  }
  return values;
}

type PlannedAttachment = {
  ref: string; sceneId: string; cue: string; viewport: string; path: string;
  sha256: string; bytes: number; dimensions: [number, number];
};
type PlannedTurn = { turnId: string; role: string; attachments: PlannedAttachment[] };
type PlannedBatch = {
  status: string; verdict: string; sourceHead: string; turns: PlannedTurn[];
};
const planPath = optional("--plan");
const role = option("--role");
const planned = planPath ? JSON.parse(readFileSync(resolve(planPath), "utf8")) as PlannedBatch : undefined;
const turnId = planned ? option("--turn-id") : undefined;
const turn = planned?.turns.find(item => item.turnId === turnId && item.role === role);
if (planned && (!turn || planned.status !== "PENDING_WEB_HIGH" || planned.verdict !== "NOT_RUN")) {
  throw new Error("Expected an unexecuted batch plan turn with the supplied role");
}
const gameRoot = planned ? resolve(option("--game-root")) : undefined;
const metas = turn?.attachments ?? [];
const imagePaths = planned
  ? metas.map(item => {
      if (!gameRoot || isAbsolute(item.path)) throw new Error("Batch PNG must have a relative game-root path");
      const file = resolve(gameRoot, item.path);
      const back = relative(gameRoot, file);
      if (!back || back === ".." || back.startsWith(".." + sep) || isAbsolute(back))
        throw new Error("Batch PNG is outside the specified game root");
      return file;
    })
  : options("--image").map(imagePath => resolve(imagePath));
const refs = planned ? metas.map(item => item.ref) : options("--ref");
const sourceHead = (planned?.sourceHead ?? option("--source-head")).toLowerCase();
const scene = turnId ?? option("--scene");
const outputArgument = option("--output");
const writer = prepareEvidenceWriter(outputArgument);
const outputPath = writer.outputPath;
const visualReview = process.argv.includes("--visual-review") || Boolean(planned);
if (imagePaths.length < 1 || imagePaths.length > 10 || refs.length !== imagePaths.length)
  throw new Error("Expected 1–10 image paths and a matching number of compiled refs");
const images = imagePaths.map((filePath, index) => {
  const buffer = readFileSync(filePath);
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const meta = metas[index];
  if (meta && (sha256 !== meta.sha256 || buffer.length !== meta.bytes)) {
    throw new Error("Batch PNG hash/size mismatch before Web transport: " + meta.path);
  }
  if (meta) {
    if (buffer.length < 24 || buffer.toString("ascii", 12, 16) !== "IHDR" ||
        buffer.readUInt32BE(16) !== meta.dimensions[0] || buffer.readUInt32BE(20) !== meta.dimensions[1])
      throw new Error("Batch PNG dimensions/format mismatch: " + meta.path);
  }
  return { path: filePath, ref: refs[index]!, buffer, sha256, fileBytes: statSync(filePath).size };
});
if (images.some((image, index) => image.ref !== `codex-input-image-${index + 1}`)) {
  throw new Error("Attachment refs must match the browser compiler order codex-input-image-1..N");
}
const totalBytes = images.reduce((sum, image) => sum + image.fileBytes, 0);
if (totalBytes > 50_000_000) throw new Error("Batch turn exceeds 50 MB browser attachment budget");
const viewports = planned ? metas.map(item => item.viewport) : ["1920x900", "390x844", "360x640"];
const receiptContext: HostObservedReceiptContext = {
  sourceHead,
  scene,
  viewport: "multi",
  attachments: images.map(image => ({ ref: image.ref, sha256: image.sha256, bytes: image.buffer.length })),
};
let receipt: HostObservedReceipt | undefined;
const events: Array<{ type: AdapterEvent["type"] }> = [];

const paths = activateDevProfileEnvironment(resolveDevProfilePaths());
const config = loadConfig();
if (config.purpose !== "dev-harness" || config.mode !== "browser-only" || config.browserHost !== "launcher") {
  throw new Error("DEV browser-only launcher configuration is not active");
}
if (!config.browserHostDescriptorPath) throw new Error("DEV launcher descriptor is missing");

const runtime = createLauncherDevAdapter(config, paths.runtimePath, {
  hostObservedReceipt: {
    context: receiptContext,
    onReceipt: value => {
      writer.persistReceipt({
        checkpoint: "browser-receipt-persisted",
        sourceHead, scene, role, turnId: turnId ?? null,
        planPath: planPath ? resolve(planPath) : null,
        attachments: images.map(image => ({
          ref: image.ref, path: image.path, sha256: image.sha256, bytes: image.fileBytes,
        })),
        receipt: value,
      });
      receipt = value;
    },
  },
});
const provider: CodexProviderConfig = {
  adapter: "chatgpt-web",
  baseUrl: "https://chatgpt.com",
  chatgptWeb: {
    appName: config.appName,
    browserHost: config.browserHost,
    browserHostDescriptorPath: config.browserHostDescriptorPath,
    localToolsEnabled: false,
    solAvailable: config.solAvailable,
    extraHighAvailable: config.extraHighAvailable,
    proAvailable: config.proAvailable,
    autoApproveToolCalls: config.autoApproveToolCalls,
    useSavedChats: config.useSavedChats,
  },
};
const nativeTurnId = `dev-host-observed-receipt-${Date.now()}`;
const request: CodexParsedRequest = {
  modelId: "chatgpt-web/gpt-6-sol",
  stream: true,
  context: {
    messages: [{
      role: "user",
      timestamp: Date.now(),
      content: [
        { type: "text", text: visualReview
          ? `You are the independent ${role} art reviewer. Review every attached actual runtime screenshot independently, without assuming PASS. Output a clear PASS or REWORK verdict, concrete findings and unresolved issues, and a specific observation for EVERY image reference. If any image is missing or uncertain, report BLOCKED. Do not invent metadata. Screenshot list in exact upload order: ${JSON.stringify(planned ? metas.map(m => ({ ref:m.ref, sceneId:m.sceneId, cue:m.cue, viewport:m.viewport })) : images.map((img,index)=>({ref:img.ref,scene,viewport:viewports[index]})))}. Include one observation for each attached screenshot. Prefer structured JSON with fields verdict, observations (ref, sceneId, viewport, verdict, observation), findings, unresolved; do not fabricate passing answers.`
          : `Review the supplied runtime evidence for ${scene} in all supplied viewports. Reply with exactly E2E RECEIVED.` },
        ...images.map(image => ({ type: "image" as const, imageUrl: `data:image/png;base64,${image.buffer.toString("base64")}`, detail: "high" as const })),
      ],
    }],
  },
  options: { reasoning: "high" },
  _chatgptModelFamily: "6",
  _rawBody: {
    prompt_cache_key: "dev-host-observed-receipt-thread",
    client_metadata: {
      "x-codex-turn-metadata": JSON.stringify({
        thread_id: "dev-host-observed-receipt-thread",
        turn_id: nativeTurnId,
      }),
    },
    input: [{
      type: "message",
      role: "user",
      content: [{ type: "input_text", text: "Review the supplied runtime evidence." }],
      internal_chat_message_metadata_passthrough: { turn_id: nativeTurnId },
    }],
  },
};

const requestedRoute = routeChatGptWebRequest(request, config);
if (requestedRoute.slug !== "chatgpt-web/gpt-6-sol" || request.modelId !== "gpt-5.6-sol"
  || request._chatgptModelFamily !== "6" || request.options.reasoning !== "high"
  || request._chatgptRequestedModel !== "chatgpt-web/gpt-6-sol") {
  throw new Error("DEV E2E route normalization did not preserve the GPT-6 Sol High request");
}

try {
  const adapter = runtime.adapterFactory(provider);
  const emittedText: string[] = [];
  await adapter.runTurn(request, { headers: new Headers() }, event => {
    events.push({ type: event.type });
    if (event.type === "text_delta") emittedText.push(event.text);
  });
  if (!receipt) throw new Error("DEV E2E completed without a host-observed receipt");
  if (receipt.providerAttested !== false || receipt.provider.taskId !== null
    || receipt.provider.responseId !== null || receipt.provider.reviewTraceId !== null) {
    throw new Error("DEV E2E produced provider fields in a host-observed receipt");
  }
  if (receipt.source.sourceHead !== sourceHead || receipt.source.scene !== scene || receipt.source.viewport !== "multi") {
    throw new Error("DEV E2E receipt source binding mismatch");
  }
  if (receipt.source.attachments.length !== images.length || receipt.source.attachments.some((item, index) => (
    item.ref !== images[index]!.ref || item.sha256 !== images[index]!.sha256 || item.bytes !== images[index]!.buffer.length
  ))) {
    throw new Error("DEV E2E receipt image binding mismatch");
  }
  if (receipt.route.requestedModel !== "chatgpt-web/gpt-6-sol"
    || receipt.route.selectedModel !== "chatgpt-web/gpt-6-sol"
    || receipt.route.reasoning !== "high"
    || receipt.route.selectedReasoning !== "high") {
    throw new Error("DEV E2E receipt route binding or selected GPT-6 High observation is missing");
  }
  writer.persistFinal({
    assurance: "host-observed",
    role,
    images: images.map(image => ({ path: image.path, ref: image.ref, sha256: image.sha256, bytes: image.buffer.length, fileBytes: image.fileBytes })),
    request: { requestedModel: request._chatgptRequestedModel, backendModel: request.modelId, selectedModel: receipt.route.selectedModel, requestedReasoning: request.options.reasoning, selectedReasoning: receipt.route.selectedReasoning, scene, viewports, sourceHead },
    stages: events,
    response: { text: receipt.answer.text, emittedText: emittedText.join(""), textSha256: createHash("sha256").update(receipt.answer.text ?? "", "utf8").digest("hex"), eventTypes: events.map(event => event.type) },
    receipt,
  });
  console.log(JSON.stringify({ outputPath, traceId: receipt.browser.bridgeTraceId, assistantTurnIdentity: receipt.browser.assistantTurnIdentity, eventTypes: events.map(event => event.type) }));
} finally {
  await closeChatGptBrowserWorkers();
}
