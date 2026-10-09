# Trusted Web Receipt Producer — upstream change request

Status: `BLOCKED_HOST_PROVENANCE_API_MISSING`

This request is based on upstream `miuuyy/codex-chatgpt-web` at
`f9ad4ae83a579287105ad822dd0c3e0029b04ef6` and the installed 6.1.6 runtime.
No producer implementation or production-art change is included in this branch.

## Observed boundary

- `src/bridge.ts` creates the Responses-compatible `resp_<uuid>` when the
  caller does not provide one. This is a local bridge/continuation identity,
  not a provider-issued ChatGPT task, response, or review-trace ID.
- `BrowserTurn` carries the locally selected `traceId`, requested `modelId`,
  and requested reasoning effort. The browser helper returns lifecycle events
  and `{type: "result", id, text}`; it does not return a provider response
  identity, provider task identity, selected model attestation, or attachment
  receipt.
- Browser completion is inferred from ChatGPT DOM turn identities and rendered
  text. Those identities are browser-local UI bindings, not a stable provider
  response API.
- Image input is decoded to a local `Buffer` before `setInputFiles`. The
  current protocol verifies that the attachment tile appears and Send becomes
  enabled, but does not expose the accepted-upload bytes/hash or a provider
  delivery receipt.
- The local limits store records local submission receipt IDs, timestamps, and
  model families. It explicitly does not claim provider response identity.

## Required trusted envelope

Add an authenticated, per-turn receipt envelope. Fields must remain distinct:

```json
{
  "schema": "codex.web.receipt.v1",
  "producerReceiptId": "local-producer-issued-id",
  "provider": {
    "taskId": "provider-issued-or-null",
    "responseId": "provider-issued-or-null",
    "traceId": "provider-issued-or-null"
  },
  "codex": {
    "sessionId": "host-authenticated-session-id",
    "turnId": "host-authenticated-turn-id",
    "parentThreadId": "host-authenticated-parent-id",
    "agentRole": "ceos_reasoner_web"
  },
  "route": {
    "requestedModel": "chatgpt-web/gpt-6-sol",
    "selectedModel": "host/provider-attested-model-or-null",
    "reasoningEffort": "high",
    "attestation": "host-authenticated"
  },
  "source": {
    "snapshot": "git-head-or-content-addressed-snapshot",
    "attachments": [
      {
        "ref": "S38-screenshot",
        "name": "screenshot.png",
        "mime": "image/png",
        "bytes": 123,
        "sha256": "64-lowercase-hex",
        "acceptedUpload": true,
        "deliveredBytes": 123,
        "deliveredSha256": "64-lowercase-hex",
        "deliveryReceipt": "host/provider receipt"
      }
    ]
  },
  "answer": {
    "status": "completed",
    "providerResponseId": "provider-issued-or-null",
    "answerSha256": "64-lowercase-hex"
  },
  "integrity": {
    "status": "verified"
  }
}
```

`producerReceiptId` may be generated locally, but must never be presented as a
provider ID. Any unavailable provider field must remain `null` with an explicit
`unavailableReason`; a generated substitute is invalid.

## Integration points

1. The host/subagent scheduler must pass authenticated session, turn, parent
   thread, agent role, requested route, and the provider invocation handle into
   the bridge. The current `multi_agent_v1` result projection must preserve the
   envelope instead of returning only `agent_id` and text.
2. `BrowserTurn` and the helper line protocol must carry an attachment manifest
   and a terminal receipt event. The bridge must hash the exact bytes before
   `setInputFiles`; the browser/host boundary must acknowledge the accepted
   upload and return the actual delivered hash/size when the provider exposes it.
3. `runBrowserTurn` must capture the provider response identity from a trusted
   Responses/backend event. DOM completion may remain a liveness check, but
   cannot be the source of a provider response ID.
4. The final response envelope must be authenticated by the host or a local
   IPC channel bound to the active session/turn. User prompt text and DOM
   attributes are not trusted sources for these fields.

## Required regression and end-to-end tests

- Provider IDs are preserved when supplied and remain `null` when absent;
  local `producerReceiptId`, bridge `resp_…`, browser `traceId`, Codex
  `sessionId`, and `turnId` are never conflated.
- One PNG proof verifies pre-send bytes/hash, accepted-upload receipt,
  delivered bytes/hash, selected model/effort, completed provider response ID,
  answer hash, and source snapshot binding.
- Lost attachment: terminal receipt is rejected and no verified receipt is
  emitted.
- Wrong hash or size: receipt is rejected before semantic acceptance.
- Wrong selected model or effort: receipt is rejected against the requested
  route.
- Stale session/turn: receipt is rejected against the current authenticated
  host context.
- Missing provider response receipt: the result is marked unverified; no task
  or review trace ID is synthesized.
- Browser-worker, helper-protocol, Responses HTTP/SSE, and `multi_agent_v1`
  projection tests cover both browser-only and full-harness paths.

## Required upstream ownership

- **Codex Web GPT / bridge:** implement byte-level attachment and provider
  response receipt capture, helper protocol, and authenticated envelope.
- **Codex host:** preserve provider receipt fields through subagent scheduling
  and return them to the caller with the current session/turn binding.
- **CEOS:** no weakening or producer simulation. The existing validator should
  continue to fail closed when task/trace/model/attachment/source receipts are
  absent; it can consume the new envelope after the host contract exists.

## Current bounded proof and negative checks

The one current-session PNG proof is persisted in the game release evidence at
`artifacts/production-art/WEB_TRANSPORT_PROOF_2026-10-09.json`. The input is
S38 `390x844` PNG, 438763 bytes, SHA-256
`dbff51bc4d12eb96532aa0cf11ca4137d97415491be23a9b21a9d8f6c5443141`.
The reviewer visibly received pixels, but the trusted host response contained
no delivered bytes/hash, task ID, review trace, attested route, or source
binding. No provider ID was invented.

A local fail-closed predicate was run against that persisted proof and rejected
all required negative cases: lost attachment, wrong hash, different model,
stale/unbound session, and missing response receipt. These are verifier checks
of the absent/invalid evidence; they are not a claim that the current host can
produce a trusted receipt.

## Verification of the audited upstream tree

- `bun test tests/bridge-collaboration.test.ts tests/browser-turn-binding.test.ts tests/browser-worker-contract.test.ts tests/chatgpt-session.test.ts tests/server-subagents.test.ts`: **174 passed, 5 skipped, 0 failed**.
- `bun run typecheck`: **passed**.
- Audit branch: `codex/trusted-web-receipts-2026-10-09`, commit
  `4f6a50480ac12640b880b56d2ac525da296e77d9` before this documentation update.
