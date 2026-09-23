# Cinematic Romance — typography lab

Статус: три типографических варианта внутри концепции A. Production runtime не изменён; окончательная пара не выбрана.

## Варианты

| Вариант | Display / accent | UI / reading | Характер |
|---|---|---|---|
| I | Cormorant Garamond Variable | Manrope Variable | выразительная антиква, высокий контраст, кинематографичный заголовок |
| II | EB Garamond Variable | Manrope Variable | более классическая книжная антиква, мягкий романтический ритм |
| III | Literata Variable | Manrope Variable | современная экранная антиква, самая спокойная для длинного чтения |

Все три варианта сохраняют композицию и палитру Cinematic Romance. Переключение: `?concept=a&type=1`, `type=2`, `type=3` или кнопки I/II/III в шапке.

## Локальные файлы и права

Файлы находятся в `prototypes/premium-ui/fonts/` и не загружаются через CDN. Все гарнитуры распространяются под SIL Open Font License 1.1; соответствующие тексты лицензий лежат рядом с файлами:

- Cormorant Garamond — Google Fonts upstream: https://github.com/google/fonts/tree/main/ofl/cormorantgaramond; кириллица, variable weight 300–700; `OFL-CormorantGaramond.txt`.
- EB Garamond — Google Fonts upstream: https://github.com/google/fonts/tree/main/ofl/ebgaramond; кириллица, variable weight; `OFL-EBGaramond.txt`.
- Literata — upstream: https://github.com/googlefonts/literata; кириллица, variable optical-size/weight; `OFL-Literata.txt`.
- Manrope — Google Fonts upstream: https://github.com/google/fonts/tree/main/ofl/manrope; кириллица, variable weight 200–800; `OFL-Manrope.txt`.

Распознаваемые русские символы из названия, длинной реплики и вариантов выбора проверены через fontTools cmap для всех четырёх TTF: missing glyphs — none.

## Проверяемые состояния

Для каждого варианта доступны меню, диалог и выбор; на выбор добавлены длинные русские формулировки. В настройках range меняет `--text-scale` и проверяет увеличение основного текста. Кнопка «Продолжить» остаётся в reachable-зоне диалоговой панели.

## Browser evidence

Подтверждены реальные screenshots Chromium: 1920×900 для меню/диалога/выбора варианта I, меню для II и III; 390×844 для меню всех трёх вариантов и выбора I; 360×640 для меню и выбора I. Проверены кириллица, переносы, строковый ритм, отсутствие CDN и локальная загрузка шрифтов.

Снимки лежат в `output/playwright/premium-a-type*.png`. In-app browser ранее блокировал localhost (`ERR_BLOCKED_BY_CLIENT`), поэтому evidence получен через Chromium Playwright.
