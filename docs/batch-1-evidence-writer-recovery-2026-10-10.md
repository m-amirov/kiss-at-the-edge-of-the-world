# Batch 1 host-observed evidence writer: safe restart

Scope: the first Batch 1 turn `batch1-ceos_reasoner_web-1` (S03/S18/S42, nine PNGs).
The previous trace `046ebbf45ad1` has only lifecycle evidence. It must remain BLOCKED and **must never be promoted** to an actual completed visual receipt.

## Persistent writing contract

- Before a browser turn: resolve an explicit **absolute** output path, verify writability, reject existing result or sidecar, load all PNGs and check their exact hash, bytes and PNG dimensions against the game plan.
- During callback `onReceipt`: synchronously and atomically persist the original `HostObservedReceipt` plus the exact input image hashes in `<output>.receipt.json`, before downstream parsing or Git operations.
- After adapter completion: atomically save the complete output at `<output>`. If this step fails, the original sidecar remains for inspection; do not claim PASS until a complete, independently verified review exists.
- Each retry requires a new filename and new host/browser identities. Never overwrite or reuse the failed trace. Host receipts remain `providerAttested=false` and provider IDs `null`.
- No `git rev-parse` is performed inside the writer or after the browser turn. If Git lineage checks are needed, do them in the game runner **before** the browser is invoked, with an explicit repository `cwd`.

## Commands on Windows PowerShell

```powershell
$bridge = 'E:\Work\_tmp\codex-chatgpt-web-audit-20261009'
$game = 'E:\Work\YandexGames\Novells\kiss-at-the-edge-of-the-world-final-rc-2026-10-09'
$plan = Join-Path $game 'artifacts\production-art\WEB_HIGH_BATCH_1_2026-10-09.json'
$bun = Join-Path $env:USERPROFILE '.bun\bin\bun.exe'
$out = Join-Path $game 'artifacts\evidence\web-high-batch-1\reasoner-turn1-attempt2.json'
Set-Location $bridge
git fetch origin bridge/trusted-web-receipts-2026-10-09
# Safely fast-forward the local bridge worktree to the published branch if clean.
& $bun run scripts/dev-host-observed-receipt-e2e.ts --plan $plan --turn-id batch1-ceos_reasoner_web-1 --role ceos_reasoner_web --game-root $game --output $out --preflight-only
# Only when preflight says READY_BROWSER_TURN_PREFLIGHT, run the identical command without --preflight-only.
& $bun run scripts/dev-host-observed-receipt-e2e.ts --plan $plan --turn-id batch1-ceos_reasoner_web-1 --role ceos_reasoner_web --game-root $game --output $out
```

Preflight does not invoke the browser, create PASS evidence, or persist an incomplete receipt. Use unique output paths per attempt. If `bun` is missing or the bridge worktree is dirty, stop rather than overwriting unrelated files.

## Stop conditions

- If `<output>.receipt.json` is absent after a completed browser turn, stop and report `BLOCKED_WEB_HIGH_BATCH_INCOMPLETE_DELIVERY`. Inspect only raw diagnostics; do not infer the answer.
- If the sidecar exists but `<output>` is absent, preserve the sidecar and diagnose final formatting. Reconstruct only fields unambiguously present in the original receipt; never fabricate the reviewer verdict or per-frame observations.
- The bridge output is **raw host-observed evidence**, not a production-art PASS. Ingest it into the game's six-turn validator with independently extracted per-frame verdicts; fail closed on any missing image, answer, trace, route or REWORK.
- Confirm this single first turn can be independently validated before starting the other five turns.
