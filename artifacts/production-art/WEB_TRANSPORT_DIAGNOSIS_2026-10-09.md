# CEOS Web High transport/provenance diagnosis

Status: `BLOCKED_WEB_TRANSPORT_PROVENANCE_RECOVERY`

## Reproduction

One current S38 runtime PNG and one JSON metadata payload were sent through `ceos_reasoner_web` on the configured `chatgpt-web/gpt-6-sol` High route. The reviewer reported `actualPixelsReceived=true` and a substantive visual description, but the host result exposed no `taskId`, `reviewTraceId`, attested model route, attachment bytes, attachment SHA-256, dimensions, actual format, or source binding.

Input: `artifacts/evidence/production-art-coverage-rc-2026-10-09/S38-s38-ordinary-day-390x844.png`

Input identity: `438763` bytes, SHA-256 `dbff51bc4d12eb96532aa0cf11ca4137d97415491be23a9b21a9d8f6c5443141`.

The reviewer host identity `01a11f76-7f0e-7c22-b5e2-c27d6f1cf9d7` is recorded only as `hostAgentId`; it is not a task or review-trace ID.

CEOS `web-preflight --json` returned `READY`, and the current host turn context selected `chatgpt-web/gpt-6-sol`. Those are bridge/session facts, not a per-call `taskId`, `reviewTraceId`, attachment receipt, or source-binding receipt.

## Root cause

The current callable host adapter returns a native `agent_id` plus final text, while the CEOS 0.5.7 Web delegation contract is only a provenance validator. The local validators in `tools/release/art-acceptance.mjs` and `tools/release/visual-content-review.mjs` validate required `taskId`, `reviewTraceId`, current `sourceHead`, complete evidence receipt and `actualPixelsReceived`; they do not invoke the Web backend or add missing receipts. The bridge health endpoint proves availability and accepting turns, not response-envelope provenance.

The prior smoke records do not prove a different trusted backend envelope. Their human-readable `WHVA-*` / `WH-S56-*` identifiers were recorded in task/evidence text, while the current host trace inventory contains no callable receipt record that binds those identifiers to attachment bytes. They must not be reused as current IDs.

## Mismatch classification

- Pixel re-encoding: not proven. A host-side image hash/size was not returned in the bounded proof.
- Payload corruption: not proven. No host bytes were made available for comparison.
- Source-binding failure: confirmed. The response has no verifiable source snapshot → attachment → response binding.
- S18 failure: the earlier `os error 3` is an attachment-path/transport failure, not evidence of a damaged S18 PNG; no host receipt exists to distinguish path resolution from payload corruption.

## Why no local CEOS fix was applied

The production-art validators are correctly fail-closed, and existing tests already reject missing Web IDs/pixel receipts. Deriving IDs from `hostAgentId`, timestamps, filenames, or response text would weaken provenance. The missing capability is in the callable host/bridge response envelope and is not patchable from this product repository without access to the bridge implementation and its trusted receipt store.

Required host capability for recovery:

`source snapshot → local screenshot bytes/hash → accepted attachment bytes/hash/format/dimensions → Web response → trusted taskId/reviewTraceId/model receipt`

Until that envelope is exposed by the host, retrying S07/S18/S26/S38/S01/S63 or running the full acceptance would only produce more unbound semantic responses. No production-art PASS record was created.
