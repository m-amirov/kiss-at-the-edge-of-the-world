# Episode 10 English editorial evidence

- Canonical repair ancestor: `57985bf1c75861de47fcbaefc87843353227dee4`
- Tested source/localization HEAD: `0e543a166b9fa543063d40330410ab7d6eef5712`
- Scene order: `S41, S42, S43, S44, S45, S46, S47, S48`
- Paragraphs: `70`; authored choices: `8`; interaction IDs: `S41-C90, S42-C90, S43-C90, S44-C90, S45-C90, S46-C90, S47-C90, S48-C90`.

The localization contract passed with 66/66 EN scenes, zero missing/extra paragraph references, structural parity and interaction parity. The ending matrix covers every reachable Eric/Nick/Damir route status and final choice, plus the complete independent Alice route. The runtime matrix passed 48 real EN browser scenarios at 1920×900, 390×844 and 360×640 with zero Cyrillic, clipping/overflow, internal scroll, console errors and failed requests; its source data is `artifacts/evidence/ep09-10-route-browser.json`.
