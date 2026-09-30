# S2 First-run language choice

S2 lets a Persian or Sorani speaker whose phone is set to English switch at once, on the very first launch.

## Contents

- What the product requires
- Layout, top to bottom
- States and variants
- Data the model supplies
- Templates
- testIDs
- Copy keys
- Reference images
- Pitfalls

## What the product requires

- First launch only. The four languages, each written in its own script: English, Deutsch, فارسی, کوردیی ناوەندی.
- The phone's language is pre-selected when it is one of the four; otherwise English.
- One big Continue button, **in the selected language**.
- One tap and done; it can be changed any time in Settings.
- After Continue, the first launch goes to the tutorial level (S13), not to Home: dispatch `set-language` and let the FirstRun group's `if` hooks move on (never `navigate`). A direction flip restarts the app on the same tap.

## Layout, top to bottom

No top bar (first launch), no banner. Body (gap 14):

1. Header column (start-aligned, gap 10, 18 pt top padding): art tile `globe` on pop paper (64, radius 16, tilted -5 deg) → title (`title` 30) → subtitle (body, muted).
2. Options column (gap 12, 10 extra top margin): four option cards (min 66, padding 10 x 14, radius 14, elevation 5) in the order en, de, fa, ckb; each autonym uses `optionNameChoice` (21 Bold) in its own script and direction; a radio mark (32, radius 9) at the end; the phone's language carries the small gold "Phone language" sticker (tilt +3 deg). The chosen card is accent, pushed in, and its radio shows a check.
3. grow.
4. Hero key without a cap, forward icon at the end: "Continue".

## States and variants

The selected option moves with each tap; the Continue label follows the selected language. "Phone language" sits on the phone's language (the design shows it on English because English is the default render).

## Data the model supplies

`LanguageChoiceModel`: `selected`, `phoneLanguage` (null when the phone's language is not one of the four), `tSelected` (t() in the selected language), `isReducedMotion`, `onSelect`, `onContinue`. The template `use-language-choice-model.ts` (with its test) builds it: the phone's languages from expo-localization's `getLocales()` (the first one the app speaks, else English preselected), `tSelected` from `createLanguageT(selected, digits, onError)` (`i18n/create-language-t.ts`: the Shell catalogs in the chosen language), a tap only previews; Continue dispatches `set-language` (which also sets `firstRun.languageChosen`) and, when the chosen language reads the other way than `readLayoutDirection()`, calls `useDirectionRestart()` (audio disposed, then the reload). The FirstRun group then opens the tutorial; the hook never navigates.

## Templates

Copy each file from `templates/` to the same path in the app repo; the code lives in `packages/shell/src/screens/first-run/`.

- `packages/shell/src/screens/first-run/language-choice-view.tsx`
- `packages/shell/src/screens/first-run/language-choice-screen.tsx`
- `packages/shell/src/screens/first-run/language-choice-view.test.tsx`
- `packages/shell/src/screens/first-run/use-language-choice-model.ts` and its test
- `packages/shell/src/i18n/create-language-t.ts`, `packages/shell/src/app/use-direction-restart.ts` and their tests

## testIDs

Exactly these, from the shared screen map (`assets/screen-testids.json`). Set the testID in the first column; the parts in the last column are drawn by that component from it. `<n>` is a stable data key (a level number, a language code, a stat id), never a list index; the only numbered series are the week columns and bars (`daily.week-day.1..7`, `stats.week-bar.1..7`: position, 1 = the oldest day, 7 = today), which WeekStrip and WeekBars number themselves. Components that take a base prop (`testIDBase`, `dayTestIDBase`, `barTestIDBase`, `segmentTestIDBase`) derive the rows marked "drawn by"; pass the base exactly (see component-contract.md). `node ${CLAUDE_SKILL_DIR}/scripts/list-screen.mjs S2` prints every element with its English text.

| testID | Component (kind) | Role | Copy key | Variants, requires | Parts the component draws |
|---|---|---|---|---|---|
| `language-choice.screen` | ScreenFrame | none |  |  |  |
| `language-choice.art` | ArtTile (pop, globe) | none |  |  |  |
| `language-choice.title` | AppText | header | `language-choice.title` |  |  |
| `language-choice.subtitle` | AppText | text | `language-choice.subtitle` |  |  |
| `language-choice.language-row.en` | OptionCard | radio |  |  | .label .radio |
| `language-choice.language-row.de` | OptionCard | radio |  |  | .label .radio |
| `language-choice.language-row.fa` | OptionCard | radio |  |  | .label .radio |
| `language-choice.language-row.ckb` | OptionCard | radio |  |  | .label .radio |
| `language-choice.phone-badge` | Sticker (gold sm, +3 deg) | text | `language-choice.phone-badge` |  |  |
| `language-choice.continue-button` | Button (primary hero, forward icon at the end) | button | `language-choice.continue-button` |  |  |

## Copy keys

| Key | English |
|---|---|
| `language-choice.title` | Choose your language |
| `language-choice.subtitle` | You can change it any time in Settings. |
| `meta.languageNames.en` | (the autonym, never translated) |
| `meta.languageNames.de` | (the autonym, never translated) |
| `meta.languageNames.fa` | (the autonym, never translated) |
| `meta.languageNames.ckb` | (the autonym, never translated) |
| `language-choice.phone-badge` | Phone language |
| `language-choice.continue-button` | Continue |

## Reference images

- `assets/reference/s2-language-choice.png` (normal; phone)

Open the image before building and compare the finished screen with it (toybox-visual-parity runs the exact comparison).

## Pitfalls

- Showing autonyms in the UI font: each one uses its own script's font (pass `language` to AppText).
- Translating the language names: autonyms never change with the UI language.
- Navigating to the tutorial by hand instead of letting the route guards switch groups.
