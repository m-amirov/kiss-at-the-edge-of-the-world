# DEV GPT-6 Sol High host-observed control

## Boundary diagnosed

Direct DEV browser calls can complete a ChatGPT DOM turn, but they do not
install the DEV-only `hostObservedReceipt` callback. The DEV E2E runner does:
it routes the catalog slug through `routeChatGptWebRequest`, starts the existing
browser-worker/helper transport with a receipt context, uploads the exact PNG
buffers, and receives the terminal receipt from the helper after the accepted
user turn and stable DOM completion.

The previous E2E path bypassed that route and hard-coded `gpt-5.6-sol` as the
request model while setting the family separately. The fix preserves the
requested catalog slug (`chatgpt-web/gpt-6-sol`) across backend normalization,
records the browser-observed selected GPT-6 Sol slug and High effort, and
requires selected-model observation in the control runner. `gpt-5.6-sol` is
kept only as the backend implementation value; it is never emitted as the
selected route.

## Receipt contract

The bridge receipt keeps requested and selected route fields separate. Selected
model is populated only from the browser model-family picker observation; if it
cannot be observed, the control runner fails closed. The receipt also binds
the source HEAD, all three PNG refs/byte hashes, accepted `user_turn` evidence,
browser trace, user/assistant turn identities, and the final assistant-answer
hash. Provider task/response/review IDs remain `null` and
`providerAttested=false`; this is host-observed evidence, not provider
attestation.

## Current scoped proof

`PASS_S38_GPT6_HOST_OBSERVED_CONTROL` was obtained from three independent
GPT-6 Sol High roles, each receiving the same current-head S38 desktop,
390x844, and 360x640 PNGs. The game-side scoped validator accepted 9/9 image
reviews and keeps the result explicitly separate from full-season acceptance.
