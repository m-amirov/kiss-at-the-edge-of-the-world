import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadConfig } from "../src/config";
import { createLauncherDevAdapter } from "../src/dev-chat/driver";
import { activateDevProfileEnvironment, resolveDevProfilePaths } from "../src/dev-chat/profile";
import { closeChatGptBrowserWorkers } from "../src/adapters/chatgpt-web/browser-worker";
import type { HostObservedReceipt, HostObservedReceiptContext } from "../src/adapters/chatgpt-web/host-observed-receipt";
import type { AdapterEvent, CodexParsedRequest, CodexProviderConfig } from "../src/types";

function option(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value || value.startsWith("--")) throw new Error(`${name} is required`);
  return value;
}

const imagePath = resolve(option("--image"));
const sourceHead = option("--source-head").toLowerCase();
const scene = option("--scene");
const viewport = option("--viewport");
const ref = option("--ref");
const outputPath = resolve(option("--output"));
const visualReview = process.argv.includes("--visual-review");
const image = readFileSync(imagePath);
const imageSha256 = createHash("sha256").update(image).digest("hex");
const imageStat = statSync(imagePath);
const receiptContext: HostObservedReceiptContext = {
  sourceHead,
  scene,
  viewport,
  attachments: [{ ref, sha256: imageSha256, bytes: image.length }],
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
    onReceipt: value => { receipt = value; },
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
  modelId: "gpt-5.6-sol",
  stream: true,
  context: {
    messages: [{
      role: "user",
      timestamp: Date.now(),
      content: [
        { type: "text", text: visualReview
          ? `Perform a concise visual control review of the supplied runtime evidence for ${scene} at ${viewport}. State whether the image is readable and whether any obvious crop, clipping, or composition defect is visible. Do not invent metadata.`
          : `Review the supplied runtime evidence for ${scene} at ${viewport}. Reply with exactly E2E RECEIVED.` },
        { type: "image", imageUrl: `data:image/png;base64,${image.toString("base64")}`, detail: "high" },
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
  if (receipt.source.sourceHead !== sourceHead || receipt.source.scene !== scene || receipt.source.viewport !== viewport) {
    throw new Error("DEV E2E receipt source binding mismatch");
  }
  if (receipt.source.attachments[0]?.sha256 !== imageSha256 || receipt.source.attachments[0]?.bytes !== image.length) {
    throw new Error("DEV E2E receipt image binding mismatch");
  }
  if (receipt.route.requestedModel !== request.modelId || receipt.route.reasoning !== "high") {
    throw new Error("DEV E2E receipt route binding mismatch");
  }
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify({
    assurance: "host-observed",
    image: { path: imagePath, ref, sha256: imageSha256, bytes: image.length, fileBytes: imageStat.size },
    request: { model: request.modelId, reasoning: request.options.reasoning, scene, viewport, sourceHead },
    stages: events,
    response: { text: emittedText.join(""), textSha256: createHash("sha256").update(emittedText.join(""), "utf8").digest("hex"), eventTypes: events.map(event => event.type) },
    receipt,
  }, null, 2)}\n`);
  console.log(JSON.stringify({ outputPath, traceId: receipt.browser.bridgeTraceId, assistantTurnIdentity: receipt.browser.assistantTurnIdentity, eventTypes: events.map(event => event.type) }));
} finally {
  await closeChatGptBrowserWorkers();
}
