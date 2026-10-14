# Consolidation and evidence retention policy

This project keeps one clean canonical development checkout and treats every
other checkout as temporary, archival, or protected recovery state.

## Canonical checkout

The current consolidated candidate is:

`E:\Work\YandexGames\Novells\kiss-at-the-edge-of-the-world-consolidation-2026-10-14`

It must remain clean while release gates are running. The original checkout
`kiss-at-the-edge-of-the-world-git` remains protected until its dirty authored
changes and evidence are independently classified; it is not a release source.

## Worktree lifecycle

1. Start from a fresh `origin/main` and record remote, branch, HEAD and dirty
   state before creating a worktree.
2. Use a registered Git worktree for bounded implementation or verification.
3. Put generated screenshots, logs, packages and browser traces in an explicit
   temporary/evidence directory, never beside production sources by accident.
4. After the result is persisted and hashed, remove only a clean, inactive
   worktree whose commits and ignored files are either reproducible or present
   in the recovery archive. Use `git worktree remove`; do not use recursive
   deletion for registered worktrees.
5. Do not delete evidence by age. A unique receipt, screenshot, source-bound
   manifest, Web High review, release snapshot, or provenance record is kept
   until its replacement is verified against the same source identity.

## Retention classes

- **KEEP**: canonical source, active dirty work, unresolved review material,
  current release configuration, and the recovery checkpoint.
- **ARCHIVE**: unique QA/Web High/runtime/release evidence and any ignored
  material that cannot be reconstructed from Git. The archive manifest records
  source path, destination, size and SHA-256.
- **DELETE**: only an inactive, clean, confirmed duplicate or reproducible
  output after the archive and checksum readback succeed.

Before any cleanup, repeat `git worktree list --porcelain`, inspect process
use, check tracked/staged/unstaged/untracked/ignored files, verify Git ancestry,
and recalculate the target directory size. Never use `git clean -fdx`, broad
recursive deletion, reset, stash, or force-push as a cleanup mechanism.

Release evidence remains source-bound: every current receipt must identify the
audited HEAD and exact runtime/configuration inputs. Local browser smoke does
not satisfy external Yandex evidence or independent Web High art acceptance.
