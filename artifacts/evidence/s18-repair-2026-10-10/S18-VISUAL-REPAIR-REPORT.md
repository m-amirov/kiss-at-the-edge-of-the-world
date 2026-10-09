# S18 visual repair report — 2026-10-10

## Verdict

`REWORK`. The local runtime candidate is structurally healthy and the 360×640 PNG no longer shows literal text glyphs over the visible upper silhouettes, but all three independent Web High reviewers still reject the mobile composition. Per instruction, no additional repair or Web turn was started.

## Root cause found

The previous S18 short-mobile rule was being pushed down by the later global mobile HUD transform. The attempted fix also left the actor image rects extending behind the dialogue region. The new bounded change keeps the existing stage scale and adds a cue-only alpha fade, but the Web reviewers correctly judged that the visible silhouettes still terminate too close to, or behind, the dialogue start on mobile.

Current product commit: `5bf338746b3b748b5b49454ee1dfb56c63ffa6be`.

Changed only:

- `S18:hofn-lighthouse` short-mobile CSS cascade and alpha mask.
- Runtime evidence reader records paragraph bounds and effective mask/transform.

No story, assets, other scenes, or dirty checkout files changed.

## Fresh runtime evidence

Fresh 9-capture evidence is bound to `5bf338746b3b748b5b49454ee1dfb56c63ffa6be`:

`artifacts/evidence/s18-repair-2026-10-10/runtime/evidence.json`

- 1920×900: no overflow/internal scroll/errors; mask not applied; desktop composition visually unchanged.
- 390×844: no overflow/internal scroll/errors; mask not applied; existing composition preserved.
- 360×640: no overflow/internal scroll/errors; effective actor mask is applied; paragraph begins at y≈291.5 and the dialogue sheet at y≈271.5.

The local runtime command returned `PASS` for all 9 captures. This is not promoted to a visual acceptance PASS because independent pixel review found a remaining mobile composition defect.

## Web High results

All three turns used the current 3 PNGs, selected `chatgpt-web/gpt-6-sol`, reasoning `high`, 3/3 attachment bindings and complete host user/assistant identities. Receipts are host-observed (`providerAttested=false`; provider task/response/review IDs are null and were not fabricated).

| role | trace | desktop | portrait390 | portrait360 |
|---|---|---|---|---|
| `ceos_reasoner_web` | `891f61b06710` | PASS | REWORK | REWORK |
| `ceos_bulk_checker_web` | `326d858d38c2` | PASS | REWORK | REWORK |
| `ceos_art_director_web` | `a33c843e1a14` | PASS | REWORK | REWORK |

Exact blocking observations:

- Reasoner / 360×640: `Критическое композиционное пересечение сохраняется. Текст начинается приблизительно на y=298 и проходит непосредственно поверх нижней части курток и силуэтов обоих персонажей. Затемнение не устраняет наложение, а лишь частично маскирует его.`
- Bulk / 390×844: `Первая строка начинается примерно на Y=527, когда нижние части силуэтов ещё находятся в этой области. Последующие строки проходят поверх ног обоих персонажей.`
- Art Director / 390×844: `Текстовый блок начинается приблизительно на уровне бёдер персонажей и перекрывает нижние части обоих силуэтов.`
- Art Director / 360×640: `Первая строка текста начинается приблизительно на уровне нижней части куртки Алисы и нижней части корпуса Эрика. Силуэты визуально обрываются в зоне начала текста.`

Raw receipts and complete responses:

- `artifacts/evidence/web-high-s18-visual-repair/reasoner-20261010.json.receipt.json` / `.json`
- `artifacts/evidence/web-high-s18-visual-repair/bulk-20261010.json.receipt.json` / `.json`
- `artifacts/evidence/web-high-s18-visual-repair/art-director-20261010.json.receipt.json` / `.json`

## Checks and stop line

- Targeted source tests: `34/34 PASS`.
- Web preflight: `3/3 READY_BROWSER_TURN_PREFLIGHT`, 3 attachments per turn, exact SHA-256/bytes/dimensions.
- No remaining Batch 1/Batch 2 scenes, merge, publication, or full-season acceptance run.
- Required next repair scope from reviewers: achieve a clean vertical separation on both portrait390 and portrait360 while preserving faces, lighthouse, text readability, and desktop.
