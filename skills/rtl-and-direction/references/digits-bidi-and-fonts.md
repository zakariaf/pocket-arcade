# Digits, bidi isolation and Arabic-script fonts

## Contents

- Digits: the locale tag decides
- Numbers outside messages
- The Numbers setting
- Bidi isolation
- Vazirmatn
- Line heights and letter-spacing
- The font test page

## Digits: the locale tag decides

Every number is formatted through a BCP 47 tag from `localeTagFor(language, digits)` (`digits.ts`). Hermes ignores `-u-nu-` natively; the forced `@formatjs/intl-numberformat` polyfill honours it, in the app and in Jest.

| Language | Automatic | Latin | Local | 1234567.89 (Automatic, 0 decimals) |
|---|---|---|---|---|
| en | `en` | `en` | `en` | `1,234,568` |
| de | `de` | `de` | `de` | `1.234.568` |
| fa | `fa-u-nu-arabext` | `fa-u-nu-latn` | `fa-u-nu-arabext` | `۱٬۲۳۴٬۵۶۸` |
| ckb | `ckb-u-nu-arabext` | `ckb-u-nu-latn` | `ckb-u-nu-arabext` | `۱٬۲۳۴٬۵۶۸` |

- Persian and Sorani use `٬` (U+066C) for grouping, `٫` (U+066B) for decimals and `٪` (U+066A) for percent: `ckb-u-nu-arabext` formats 1234.5 as `۱٬۲۳۴٫۵` and 0.42 as `۴۲٪`.
- ckb's CLDR default is Arabic-Indic `٠١٢` (`new Intl.NumberFormat('ckb')` gives `١٢٣`); the product wants Persian-style `۰۱۲` for Sorani too, hence `arabext`.
- The same tag goes to `I18nProvider`, so numbers inside catalog messages (`{x, number}`, plural `#`) get the same digits.
- Saves always store plain numbers; digits are display only.

## Numbers outside messages

A level number on a tile, monster health drawn by Skia, the previews in Settings, a price from the store:

```ts
const formatNumber = createNumberFormatter(localeTagFor(language, digits));
const numberText = formatNumber(12); // "۱۲" in fa, "12" in en
```

A rate shown as a bare percentage (the S10 win rate, "62%" in en, "۶۲٪" in fa and ckb) uses the percent formatter from the same module, never a catalog sentence and never a hand-glued sign:

```ts
const formatPercent = createPercentFormatter(localeTagFor(language, digits));
const winRateText = formatPercent(0.62); // "62%" en, "62 %" de (no-break space), "۶۲٪" fa and ckb
```

It rounds to a whole percentage and uses the locale's own sign and spacing (`style: 'percent'`); `create-number-formatter.test.ts` pins all four languages and the Latin choice.

- Formatting happens in JS (the screen's model hook or the board presenter); components and the board receive **strings**.
- `Intl.NumberFormat` always gets a tag from `localeTagFor` (never a literal `'en'`, `undefined` or nothing); `check-rtl.mjs` fails otherwise. The store price formatter re-formats a numeric store price with the same tag (`style: 'currency'`), and falls back to the store's own string.
- A value that must stay Latin (a code or symbol) uses `localeTagFor(language, 'latin')` for that value only, with a comment saying why.

## The Numbers setting

Settings has a "Numbers" row: Automatic / Latin / Local. Each option shows a live preview, e.g. "Local ۱۲۳", produced by `createNumberFormatter(localeTagFor(language, option))(123)`. No digits are typed into catalogs. For en and de all three options give Latin digits, which the previews make obvious (the row stays for them; hiding it for en/de is an open owner decision).

## Bidi isolation

- Free text interpolated into a sentence (a pack name, a formatted date, the autonym in "System (فارسی)", a game name) is wrapped in U+2068 FIRST STRONG ISOLATE … U+2069 POP DIRECTIONAL ISOLATE, so its own direction cannot reorder the sentence. `t()` does this for every `*Name`/`*Text` placeholder; other free text uses `isolate()` from `bidi.ts`.
- Verified: in fa, `levels.pack.locked` with `packName: 'Beginnings'` keeps the Latin name in place; on iOS 26.5 with Vazirmatn the isolates render invisibly (no tofu).
- Numbers are never isolated (they are formatted inside the sentence and take its digits); select keys are never isolated (the match would fail).
- **No bidi controls anywhere else:** not in catalogs (U+202A–U+202E, U+2066–U+2069), not in source code (raw or as `\u` escapes, except in `bidi.ts`), and never the Arabic Letter Mark U+061C, which Vazirmatn lacks, or LRM/RLM (U+200E/U+200F) as a layout fix.
- Game names stay Latin in every language (brand names), in the Latin display face, isolated LTR inside RTL text.
- Tests compare with `FSI`/`PDI` in the expected string, or strip them with `stripIsolates()`.

## Vazirmatn

- **Vazirmatn v33.003**, static `Vazirmatn-Regular.ttf` and `Vazirmatn-Bold.ttf` (about 123 KB each), from `https://github.com/rastikerdar/vazirmatn/releases/download/v33.003/vazirmatn-v33.003.zip` (path `fonts/ttf/`), committed with its licence as `Vazirmatn-OFL.txt` (SIL Open Font License 1.1) in every `apps/<game>/assets/fonts/`, next to the other Toybox fonts (`LilitaOne.ttf`, `Rubik-Regular.ttf`, `Rubik-Bold.ttf`, `LilitaOne-OFL.txt`, `Rubik-OFL.txt`). S11d lists "Vazirmatn 33.003, SIL Open Font License 1.1".
- Embedded by the `expo-font` config plugin: `['expo-font', { fonts: ['./assets/fonts/Vazirmatn-Regular.ttf', './assets/fonts/Vazirmatn-Bold.ttf', …] }]` (paths relative to the app; the `…` are the Latin Toybox faces `LilitaOne.ttf`, `Rubik-Regular.ttf`, `Rubik-Bold.ttf`, which the design system adds). The file name equals the PostScript name, so `fontFamily: 'Vazirmatn-Regular'` works on iOS and Android.
- **Never load fonts at runtime** (`useFonts`, `Font.loadAsync` with URLs): the plugin embeds them, so they exist at the first frame and nothing is downloaded.
- **Never set `fontWeight` together with a custom family:** pick the weight's own family (`Vazirmatn-Bold`).
- Coverage (verified with fontTools): all Persian letters, all Sorani letters including ڕ ڵ ۆ ێ ە ڤ ھ, `۰–۹`, `٠–٩`, `٫ ٬ ٪ ، ؛ ؟`, ZWNJ/ZWJ, LRM/RLM. Missing: U+061C ALM (hence FSI/PDI) and U+1E9E ẞ (handled by the Latin font). Backup font if ever needed: Noto Sans Arabic 2.012 (OFL, covers ALM, variable, 845 KB).
- The font follows the language of the **text**, not the UI: autonyms in the language list use their own script's font.

## Line heights and letter-spacing

Arabic script needs more line height than Latin; too little clips the marks above and below. `fonts.ts` (template, the same file the design system uses) picks the family from the language of the text and the Toybox face: `display` = Lilita One in en/de and Vazirmatn Bold in fa/ckb, `text` = Rubik Regular/Bold or Vazirmatn Regular/Bold, `brand` = Lilita One in every language (game names). `use-localized-text-style.ts` then applies the type role's line-height ratio for the script (`{ latin, arabic }`; defaults display 1.1 / 1.45, text 1.32 / 1.5), snaps the product to the device pixel grid (`lineHeight = snapToPixels(fontSize * ratio)`: 17 x 1.5 = 25.5 becomes 77/3 on a 3x phone, never 26), and drops letter-spacing for Arabic script. Whole-point rounding (26) made every Persian line up to 0.5 pt taller than the Toybox RTL references and drifted S4 fa by 1-2 pt; a raw fraction drifts too, because React Native rounds each text box up to whole pixels. Never compensate Persian glyph placement with padding or `translateY`: the Vazirmatn madda (آ) is drawn 0.8-1.3 pt narrower by CoreText than by Chrome, and the parity gate measures that, not the layout. The Toybox Arabic-script line heights per role:

| Toybox role | Arabic-script face | Line height |
|---|---|---|
| display, title, heading (Lilita One roles) | Vazirmatn Bold | 1.45 |
| number (stat values) | Vazirmatn Bold | 1.1 |
| body, row labels, lead | Vazirmatn Regular | 1.5 |
| label (buttons) | Vazirmatn Bold | 1.45 |
| caption | Vazirmatn Regular | 1.6 |
| prose (privacy policy) | Vazirmatn Regular | 1.75 |

Letter-spacing is always 0 in Arabic script. The screenshot matrix (fa and ckb, at 200 % text) is the judge: no clipped marks, no overlapping lines.

## The font test page

The debug menu (test builds) has a font test page: every Persian and Sorani letter, both digit sets, the separators, and a mixed-direction sentence with isolates, in every font and weight. It is part of the screenshot matrix before each release.
