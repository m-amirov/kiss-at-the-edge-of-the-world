# Episode 9 English editorial evidence

- Canonical repair ancestor: `57985bf1c75861de47fcbaefc87843353227dee4`
- Tested source/localization HEAD: `0e543a166b9fa543063d40330410ab7d6eef5712`
- Scene order: `S36, S37, S51, S38, S54, S39, S57, S40, S64, S60`
- Paragraphs: `100`; authored choices: `14`; interaction IDs: `S36-C90, S37-C90, S51-C90, S38-C90, S54-C90, S39-C90, S57-C90, S40-C90, S64-C90, S60-C90`.

The localization contract passed for each scene. Stable scene/chunk/paragraph references, authored choice IDs, option codes, predicates, route intent/status and save semantics were retained. The Episode 9 route test covered active, paused and closed incoming states; its C90 checks verified source insertion and immediate canonical continuation for both options. The full semantic and browser result is recorded in `artifacts/evidence/ep09-10-ending-continuity.json`.
