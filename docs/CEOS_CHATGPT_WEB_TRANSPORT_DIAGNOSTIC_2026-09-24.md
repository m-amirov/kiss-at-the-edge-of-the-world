# CEOS → codex-chatgpt-web transport diagnostic — 2026-09-24

## Scope

Диагностика транспорта выполнена отдельно от игры. Игровые ассеты, CSS и сценарий не изменялись.

## Installed adapter and model mapping

Installed version: `codex-chatgpt-web 6.0.0` at `C:\Users\user\.codex-chatgpt-web\versions\6.0.0-win32-x64`.

The active `browser-helper.cjs` contains these model rows:

- `chatgpt-web/gpt-5.6-sol-instant` → `GPT-5.6 Sol Instant (Web)`, backend `gpt-5.6-sol`, low effort only;
- `chatgpt-web/gpt-5.6-sol` → `GPT-5.6 Sol (Web)`, backend `gpt-5.6-sol`, supported `medium/high/xhigh`, default high effort;
- legacy `chatgpt-web/high` → backend `gpt-5.6-sol`, `codexEffort: high`, `adapterEffort: high`.

The runtime config reports `solAvailable: true`, `extraHighAvailable: false`, `proAvailable: false`. The evidence does not support substituting Instant or downgrading High. No adapter change was made.

## Chain result

| Stage | Result | Evidence |
|---|---|---|
| CEOS routing | PASS | `ceos web-preflight --json`: `READY`; delegated role was `ceos_bulk_checker_web` |
| Model/effort selection | PASS | failed trace `1b5b53d608a1-77eb8bf7`: `08-effort-selected`, `09-effort-selection-confirmed`; slider value `2`, selected effort item remained checked |
| PNG loading | PASS | same trace reached `11-prompt-attachment-complete` and `12-file-attachment-complete` |
| Send readiness | PASS | same trace reached `13-send-ready`; send button was visible/enabled by adapter path |
| Submission acknowledgement | FAIL/BLOCKED | same trace ended at `14-turn-failed` with `ChatGPT browser stage timed out: send` |
| Model response | NOT REACHED | no `14-send-accepted`, `15-response-visible`, or `16-turn-completed` in that trace |

The earlier `ChatGPT composer rejected the plain-text editing command` trace failed before the attachment/send stage and is a separate prompt-editing failure. It does not prove a model-name mismatch.

## Minimal current test

No confirmed current S16/360 response was obtained. The current independent-review attempt failed before image handoff with the transport error recorded in the visual evidence. Existing successful diagnostics (`e16b5311edb2-6f64b653`, `8f22c57139ec-d72c95fd`) show that the same installed adapter can reach `send-accepted`, `response-visible`, and `turn-completed`, including the file-attachment stages, but they are not a fresh S16 acceptance result.

`codex-chatgpt-web doctor` and `browser check` both pass: authenticated launcher reachable, route installed, proxy healthy, Playwright can reach ChatGPT. These checks do not prove current send acknowledgement.

## Verdict

`WEB_REVIEW: BLOCKED`

Root cause is localized to the current browser submission/acknowledgement stage after model selection and PNG attachment, not to the displayed-model mapping. No unsupported selector or stale-name patch was applied. Full visual regression, project tests, and publication remain stopped until a fresh `local_image` request reaches `send-accepted` and returns a model response.

## Sequential recovery tests

### Text-only test

- CEOS role: `ceos_bulk_checker_web`.
- Request: one short text prompt, no attachment.
- Result: `OK`.
- Trace: `d3795a0d448a-6235eb82`.
- Checkpoints: `send-ready` → `send-accepted` → `response-visible` → `turn-completed`.
- Final DOM: one visible contenteditable composer with `textChars: [0]`; assistant response present with `textChars: 17`; `user: 1`; completion action present.

### One-PNG test

- CEOS role: `ceos_bulk_checker_web`.
- Input: one PNG, `S16-s16-guesthouse-help-360x640.png`.
- Result: `IMAGE_RECEIVED`.
- Trace: `8f2ef551a093-5ec7325d`.
- Checkpoints: `prompt-attachment-complete` → `file-attachment-complete` → `send-ready` → `send-accepted` → `response-visible` → `turn-completed`.
- Final DOM: `user: 1`; assistant response present with `textChars: 48`; completion action present.

These tests prove that text submission and one-PNG submission can complete through the current adapter. No model routing or selector patch was required.

## Follow-up visual review attempt

- Attempt trace: `64cbbbcbbfb5-950764d1`.
- Requested image: current `S16-s16-guesthouse-help-360x640.png`.
- Failure: `ChatGPT composer rejected the plain-text editing command`.
- Failure stage: after model/effort selection, before `prompt-attachment-complete`; no PNG handoff, send, or response occurred.
- Visual verdict: unavailable; do not mark S16/360 PASS.

Overall remains `WEB_REVIEW: BLOCKED` for the visual acceptance. The generic transport is recovered for the two minimal tests, but this independent visual-review attempt failed before image transfer. No game changes or model-routing changes were made.

## S16/360 short visual control

Comparison of the successful PNG trace `8f2ef551a093-5ec7325d` with failed review trace `64cbbbcbbfb5-950764d1` found the first differing browser state at composer readiness: the successful path had the contenteditable composer focused as a textbox, while the failed review path had focus on a button and later failed during plain-text insertion. The successful path then used one short prompt plus one `local_image` and reached `send-accepted`.

Control request used exactly one short prompt and the current PNG, with no extra JSON or attachments. Attempt trace: `01a0d463-6194-7b21-9c3b-8d0c7b4b6fa7`. The independent reviewer returned:

`PASS — повреждённая лодыжка полностью видна над нижним текстовым блоком, включая область стопы и место травмы. Обе руки мужчины также полностью находятся в видимой области: левая рука у лодыжки и правая рука поддерживает ногу, они не перекрыты текстом и не обрезаны.`

Verified image: `assets/cg/s16-guesthouse-help-portrait.png`; SHA-256 `50F5353FFACF349DCF7C13709AC654A03B9EB7112AF16924E9F1E6FBA7193550`.

The short control passed through the current adapter without any adapter, selector, model-routing, or timeout change.
