# Web High Batch 1 — turn 1 evidence report

Date: 2026-10-10
Scope: `batch1-ceos_reasoner_web-1` only
Bridge staging HEAD: `0640e5986269d92a1f437225a16fd8097cb4adbf`
Game checkout HEAD: `e770418806dec7c37097ae370bae387e6b4b21c8`

## Preflight

Result: `PASS — READY_BROWSER_TURN_PREFLIGHT`.

- Plan: `WEB_HIGH_BATCH_1_2026-10-09.json`, status `PENDING_WEB_HIGH`, verdict `NOT_RUN`.
- Source binding in plan and receipt: `e106c59695a5092b0ad13fa0515e83989bc47837`; it is an ancestor of the supplied game HEAD `e770418…`.
- Attachments: 9/9, refs `codex-input-image-1` through `codex-input-image-9`, exact compiler order.
- Total bytes: `7,478,028` (under the 50 MB turn limit).
- All nine PNGs passed independent SHA-256, byte-count, PNG signature/IHDR and dimensions checks.
- Output path was absolute, writable, new, and had no pre-existing result or sidecar.
- Browser was not invoked by preflight.

| Ref | Scene / viewport | Bytes | Dimensions | SHA-256 |
|---|---|---:|---:|---|
| 1 | S03 / desktop | 1,558,898 | 1920×900 | `0bdfacea9efe77e619fbe52c2f8a59280339bace66e8c7e0820c7803021e09ce` |
| 2 | S03 / portrait390 | 423,548 | 390×844 | `c51f26f534eb19f5c876d8d6f90d05b341a9c99502f4645bbad796b8c11bc3cc` |
| 3 | S03 / portrait360 | 298,139 | 360×640 | `45e0ed2bbce25158fdeeca26ada269c2ad76131ed940d0e84e681b54ca939284` |
| 4 | S18 / desktop | 1,834,555 | 1920×900 | `3e8c1da3e2e5e7d33f640fe46d10fc3bb043aa06dcb654d58662ad852b4389a4` |
| 5 | S18 / portrait390 | 427,696 | 390×844 | `7fecf479639a70f1a9ba5289e901c8feeb6b48b71236081dc73292b573d8c1ee` |
| 6 | S18 / portrait360 | 297,949 | 360×640 | `55096d5f4c57acb7687de5fbcd79842dd157dd29314dfb3e266a376cdb7392af` |
| 7 | S42 / desktop | 1,852,148 | 1920×900 | `2d0d1956db76feeba0d862318566e6434969088c8065b6ec439a244939fac4fd` |
| 8 | S42 / portrait390 | 457,629 | 390×844 | `4a98cdd0ec252a7c9c9e83d93704a47ab1cd716e8e52b19dc50843cbe46aad07` |
| 9 | S42 / portrait360 | 327,466 | 360×640 | `03bf063ac3e5ff0bd9571fcedd26cd71c5ad8d847611b108e589ca79460f1cfa` |

## One new Web High turn

Result: delivery completed and independently verified; semantic visual verdict is `REWORK`.

- Output: `reasoner-turn1-attempt3-20261010.json`.
- Raw host-observed receipt sidecar: `reasoner-turn1-attempt3-20261010.json.receipt.json`.
- Host trace: `0f0c1244ba00` (new; historical `046ebbf45ad1` was not used).
- Selected route: `chatgpt-web/gpt-6-sol`, reasoning `high`.
- User identity: `group:user:12008776-56bd-4f80-9995-b916965f1da9`.
- Assistant identity: `group:assistant:12008776-56bd-4f80-9995-b916965f1da9`.
- Host receipt is explicitly unattested by provider (`providerAttested=false`; provider task/response/review IDs are `null`).
- Complete answer is present; final response hash matches the receipt answer hash; terminal `done` event is present.
- Independent parse found 9/9 non-empty observations with matching ref, scene and viewport.

## Scene verdicts

- `S03`: `PASS` — 3/3 frames.
- `S18`: `REWORK` — desktop and portrait390 `PASS`; portrait360 `REWORK` (`S18-P360-COMPOSITION`).
- `S42`: `PASS` — 3/3 frames.

The reported defect is the 360×640 S18 composition: the dialogue block visually cuts into both characters' torsos while excess upper space remains. Recheck is required after a scene-specific correction. This is not a Batch 1 `PASS`: the other five turns were not started, and the batch remains incomplete.

## Scope boundary

No assets, Batch 2 turns, merge, publication, or moderation submission were performed.
