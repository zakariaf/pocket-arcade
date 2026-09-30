# S11a Language

S11a lets the player pick System or one of the four languages.

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

- Language: System / English / Deutsch / فارسی / کوردیی ناوەندی.
- The text switches at once. A change of direction (for example English to Persian) shows "Restart to apply" (S14) and restarts with one tap; the save is untouched either way.

## Layout, top to bottom

Top bar "Language" with Back. Body (gap 14):

1. A list: first row "System (English)" with the description "Uses your phone's language." and a radio mark; then one row per language with its autonym (`optionNameList` 18 Bold, own script and direction) and a radio mark. The chosen row's radio shows a check.
2. A note panel (row, centred, gap 12): pop icon tile `globe` + "Persian and Sorani use a right-to-left layout."

## States and variants

System is chosen while the app follows the phone; the System label names the language it resolves to.

## Data the model supplies

`SettingsLanguageModel` (in `language-view.tsx`): `selected` (null = System), `systemLanguage`, `onSelect` (settings-and-preferences' `language-change.ts` decides whether the restart dialog opens), `onBack`, `isReducedMotion`. The list has no tab (the Toybox `List`); each row is a `ListRow` with `end="radio"`, `isSelected` and `onPress`; autonym rows pass `labelLanguage`.

The template `use-settings-language-model.ts` (with its test) builds it: the saved choice from the settings store, System resolved against expo-localization's `getLocales()`, and a row that dispatches `planLanguageChange(...).action` at once; when the direction flips it opens the S14 `restart-to-apply` dialog, whose Restart calls `useDirectionRestart()` (audio disposed, then the reload) and whose Later keeps the old layout until the next launch.

## Templates

Copy each file from `templates/` to the same path in the app repo; the code lives in `packages/shell/src/screens/settings/language/`.

- `packages/shell/src/screens/settings/language/language-view.tsx`
- `packages/shell/src/screens/settings/language/language-screen.tsx`
- `packages/shell/src/screens/settings/language/language-view.test.tsx`
- `packages/shell/src/screens/settings/language/use-settings-language-model.ts` and its test

## testIDs

Exactly these, from the shared screen map (`assets/screen-testids.json`). Set the testID in the first column; the parts in the last column are drawn by that component from it. `<n>` is a stable data key (a level number, a language code, a stat id), never a list index; the only numbered series are the week columns and bars (`daily.week-day.1..7`, `stats.week-bar.1..7`: position, 1 = the oldest day, 7 = today), which WeekStrip and WeekBars number themselves. Components that take a base prop (`testIDBase`, `dayTestIDBase`, `barTestIDBase`, `segmentTestIDBase`) derive the rows marked "drawn by"; pass the base exactly (see component-contract.md). `node ${CLAUDE_SKILL_DIR}/scripts/list-screen.mjs S11a` prints every element with its English text.

| testID | Component (kind) | Role | Copy key | Variants, requires | Parts the component draws |
|---|---|---|---|---|---|
| `settings-language.screen` | ScreenFrame | none |  |  |  |
| `settings-language.top-bar` | TopBar | none |  |  | .back-button .title |
| `settings-language.list` | ListGroup | none |  |  |  |
| `settings-language.language-row.system` | ListRow | radio |  |  | .label .description .radio |
| `settings-language.language-row.en` | ListRow | radio |  |  | .label .radio |
| `settings-language.language-row.de` | ListRow | radio |  |  | .label .radio |
| `settings-language.language-row.fa` | ListRow | radio |  |  | .label .radio |
| `settings-language.language-row.ckb` | ListRow | radio |  |  | .label .radio |
| `settings-language.direction-note` | NotePanel | none |  |  | .icon .label |

## Copy keys

| Key | English |
|---|---|
| `common.back` | Back |
| `language.title` | Language |
| `settings.language.system` | System ({languageName}) |
| `language.system.description` | Uses your phone’s language. |
| `meta.languageNames.en` | (the autonym, never translated) |
| `meta.languageNames.de` | (the autonym, never translated) |
| `meta.languageNames.fa` | (the autonym, never translated) |
| `meta.languageNames.ckb` | (the autonym, never translated) |
| `language.direction-note` | Persian and Sorani use a right-to-left layout. |

## Reference images

- `assets/reference/s11a-language.png` (normal; phone)

Open the image before building and compare the finished screen with it (toybox-visual-parity runs the exact comparison).

## Pitfalls

- Restarting for a same-direction change (only a flip needs it).
- Autonyms in the UI font or translated.
