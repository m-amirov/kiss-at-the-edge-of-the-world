# S18 REWORK diagnosis — 2026-10-10

## Source-bound target

- Scene/cue: `S18:hofn-lighthouse`
- Source scene: `S18. Маяк. Эрик и неотправленная открытка`
- Authored cast: Alice and Eric
- Authored paragraph begins: `За домами ветер был слабее, чем у лагуны, но на открытом участке холод сразу нашёл щель между шарфом и воротником.`
- Existing portrait asset: `s18-hofn-harbour-portrait.webp`
- Pre-repair product HEAD: `e2468c1361a67fead5f13a02e660223f673c4564`

## Exact Web High observation

Reasoner finding `S18-P360-COMPOSITION` on `codex-input-image-6` (360×640):

> На экране 360×640 текстовый блок начинается непосредственно под лицами Алисы и Эрика и перекрывает значительную часть их торсов. Из-за этого персонажи визуально обрываются на уровне груди, а большая часть нижней композиции скрывается текстом. Верхняя часть экрана при этом занята преимущественно небом и горами. Лица, маяк, текст и навигация видны, однако вертикальное распределение пространства неудачное. Требуется корректировка композиции именно для короткого мобильного viewport.

## Independent confirmation

The real pre-repair `S18-hofn-lighthouse-360x640.png` shows the dialogue sheet beginning at approximately y=272 while the two character cut-outs continue to approximately y=546; the sheet therefore starts directly below the faces and covers the torsos. The adjacent `390×844` and `1920×900` PNGs retain visible separation and do not show this short-viewport cutoff. The source cue and neighboring cue mapping confirm the issue is presentation-only: no authored text, cast, asset, route, or scene transition is defective.

## Bounded repair

The repair adds a cue-owned `stageComposition` for `S18:hofn-lighthouse` and applies it only under `max-width:680px` and `max-height:700px`. The scene text, asset, cast, route, and all other cues remain unchanged.
