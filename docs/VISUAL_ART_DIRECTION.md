# VISUAL ART DIRECTION CONTRACT
## «Поцелуй на краю света»

Этот контракт обязателен для новых и изменяемых сцен.

1. Scene-first, not sticker-first
Визуал должен ощущаться цельной сценой.
Не использовать маленькую вырезанную фигуру поверх большого фона, если можно показать героя как часть композиции.

2. Single-character priority
Если в сцене один главный герой:
предпочитать полноценный full-scene CG или крупный integrated shot.
Избегать маленькой full-body фигуры в центре большого пустого пространства.

3. Character scale
На mobile главный активный персонаж должен занимать визуально значимую часть кадра.
Ориентир: примерно 35–60% полезной высоты сцены, если нет осознанной причины делать его меньше.

4. Face readability
Лица ключевых персонажей должны быть читаемы без увеличения экрана.
Не допускать случайного clipping головы, глаз или лица viewport edge.

5. Two-person composition
Для диалогов двух персонажей использовать:
- two-shot,
- over-the-shoulder,
- balanced medium composition,
а не две маленькие фигуры, расставленные по краям.

6. Group scenes
Показывать минимальное число персонажей, которое сохраняет смысл текущей сцены.
Для обычного background-stage диалога предпочтительны 1–2 focal characters.
Если текущий beat явно требует присутствия 3–4 персонажей — действием,
обращением, размером/составом группы, explicit visual cue или continuity —
никого из required cast нельзя скрывать ради ограничения количества фигур.
Сначала использовать responsive group layout: depth, staggered placement,
overlap и разные desktop/mobile размеры. Если 3–4 персонажа всё равно
становятся нечитаемыми, cue становится кандидатом на dedicated group CG.

7. Perspective consistency
Фон и персонажи должны совпадать по:
- масштабу;
- линии пола;
- горизонту;
- глубине;
- предполагаемому расстоянию до камеры.

Персонаж не должен выглядеть наклеенным поверх окружения.

8. Mobile is a first-class composition
Portrait 390×844 — отдельная композиционная цель, а не случайный crop desktop asset.
Для проблемных сцен использовать:
- portrait asset,
- per-cue focal point,
- portrait-safe derivative.

9. Desktop/mobile consistency
Смысл сцены должен сохраняться на обоих viewport.
Допустимо использовать разные desktop/mobile derivatives, если это улучшает композицию.

10. Full-scene CG for important beats
Для:
- романтических моментов;
- конфликтов;
- одиночных эмоциональных сцен;
- ключевых reveal;
- важных локаций
предпочитать полноценный CG, а не generic background + portrait.

11. Avoid dead space
Большие пустые участки допустимы только как осознанный композиционный приём.
Не оставлять огромную свободную комнату вокруг маленького героя.

12. UI safe area
Лица и композиционный фокус не должны конфликтовать с:
- верхним HUD;
- кнопками Menu/Back;
- нижним dialogue sheet;
- Yandex ad area.

13. Text readability over art
Фон под UI/text должен обеспечивать достаточный контраст.
Использовать мягкие gradients/overlays.
Не использовать тяжёлые чёрные плашки и сильный glow без необходимости.

14. Menu hierarchy
Главный CTA визуально доминирует.
Secondary actions должны иметь меньший вес.
Utility actions типа cloud restore не должны конкурировать с «Продолжить» / «Новая игра».

15. No global fix for local composition
Если один cue требует другого framing:
использовать per-cue mapping/focal point.
Не менять глобальный asset family так, чтобы исправить одну сцену и испортить остальные.

16. Reuse approved art intelligently
Сначала:
- existing full-scene asset;
- existing portrait derivative;
- crop/focal configuration.
Только потом создавать новый derivative.
Не генерировать новый арт без необходимости.

17. Visual acceptance requires pixels
HTTP 200, DOM presence и правильный asset mapping не являются visual PASS.
Нужен fresh screenshot конкретного viewport.

18. Required visual evidence
Для любого visual repair минимум:
- mobile screenshot;
- desktop screenshot;
- exact cue identification;
- соседний scene regression check.

19. No broken continuity
Visual cue должен соответствовать:
- месту;
- времени суток;
- персонажам;
- текущему narrative beat.
Нельзя менять композицию ценой continuity.

20. Final acceptance
Сцена считается принятой только если:
- персонажи соразмерны окружению;
- композиция выглядит намеренной;
- mobile не выглядит хуже desktop;
- нет sticker-like effect;
- нет clipping ключевых лиц;
- нет новых 404/overflow/scroll defects.
