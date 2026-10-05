# Yandex Games documentation review — 2026-10-05

## Scope and sources

Fresh watcher run `2026-10-05T04-37-03-907Z` fetched the three canonical Yandex Games sources and all discovered requirement detail pages. This review compares the watcher report with `config/yandex-requirements.yaml`, `config/yandex-console-requirements.yaml`, `config/yandex-doc-snapshot.json`, `game-spec.yaml`, and the current production checks.

## Classified watcher changes

| Watcher classification | Reviewed item | Classification | Outcome |
| --- | --- | --- | --- |
| `DRAFT_CONSTRAINT_CHANGED` | `official:comment` | Metadata/parser text drift. The current page still describes an optional moderation-only developer comment, max 2048 characters; no project obligation changed. | No registry or product change. |
| `DRAFT_CONSTRAINT_CHANGED` | `official:title` | Metadata/parser text drift. The current page retains the established title rules (required, max 50 characters, capitalized, unique, consistent across materials). | Existing requirement 5.1.3/5.12 registry coverage remains sufficient. |
| `MODERATION_POLICY_CHANGED` | moderation headings: waiting time, queue factors, reducing publication wait | Detail-page-only operational guidance. It does not add a product, archive, Draft-field, moderation-submission, or release obligation. | No registry or product change. No submission was started. |
| `DETAIL_PAGE_CHANGED` | requirements 1.2 | Current rule remains: no third-party registration; Yandex ID only by explicit user action; guest play possible. | Covered by registry 1.2; no change. |
| `DETAIL_PAGE_CHANGED` | requirements 1.3 | Current rule remains stopping game sound on focus loss. | Covered by registry 1.3 and lifecycle evidence; no change. |
| `DETAIL_PAGE_CHANGED` | requirements 1.6 | Current rule remains compliance with declared device types. | Covered by registry 1.6 and platform matrix; no change. |
| `DETAIL_PAGE_CHANGED` | requirements 1.6.3 | TV-specific detail only. Android TV is not declared by this project, so it is inapplicable. | Registry 1.20.4 remains explicitly conditional; no change. |
| `DETAIL_PAGE_CHANGED` | requirements 1.10 | Current responsive/no-clipping/no-scroll/no-overlap/one-hand obligations remain represented by registry 1.10.1–1.10.4. | Existing visual and mobile checks remain applicable; no change. |
| `DETAIL_PAGE_CHANGED` | requirements 1.12 | Current rule remains monetization by ads or IAP. | Registry 1.12 and project ads contract remain sufficient; no change. |
| `UNCLASSIFIED_CHANGE` | requirements root semantic hash | No numbered clauses were added, changed, repealed, or reactivated (157 before/after). The hash changed due to the classified linked-page/revision material above. | No registry or product change. |

## Verdict

`PASS_NO_PROJECT_OBLIGATION_CHANGE` — the canonical sources were reviewed on 2026-10-05. The registry and Console registry remain accurate; the official snapshot may be accepted through the documented explicit acceptance command. This evidence does not assert Draft upload, moderation submission, or publication.
