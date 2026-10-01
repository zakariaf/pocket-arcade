# S11d Licences

S11d lists the open-source components, fonts and sound sources with their licences.

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

- Licences: open-source components, fonts, and CC0 or code-made sound sources with their licence notes. Names and licences are never translated.

## Layout, top to bottom

Top bar "Licences" with Back. Body gap **18** (a tall frame; the body scrolls):

1. Intro paragraph: "{gameName} is built with these open-source components, fonts and sounds…"
2. Four groups (group tab + list): Fonts (`doc`), Open-source software (`grid`), Ads and purchase (`ad`), Sounds (`music`).
   - A row with a description (Vazirmatn) is a column: name + version in Bold (isolated LTR), description 14, licence 14, and a quiet "Show licence text" nudge with a chevron at the end, centred in the column (`alignSelf: 'center'`).
   - Other rows: the name in Bold (`isStrong`) as the label, the licence under it, chevron; the row opens the licence text.
   - Versions: only the deck's Vazirmatn shows one ("Vazirmatn 33.003"). The design names the two other faces, Lilita One and Rubik, without a version, so `licence-entries.ts` gives them none.
   - Fonts: Vazirmatn 33.003, Lilita One 1.002, Rubik 2.300 (SIL Open Font License 1.1).

## States and variants

One state. A game appends its own credits after the Shell's entries: `creditRowsOf(useGameHost().credits)` (from `packages/shell/src/art/credit-rows.ts`; the rows come from the game's `GAME_ART.credits`).

## Data the model supplies

`LicencesModel` (in `licences-view.tsx`): `gameName`, `entries` (`shellLicenceEntries(t)` from `licence-entries.ts`, then the game's), `isReducedMotion`, `onBack`, `onShowText(key)`. Rows are keyed by the kebab-case component name (`licences.entry-row.react-native`). Each row passes its licence as the row's description with its own map id (`description`, `descriptionTestID="<row>.licence"`), so the licence sits in the text column like any description. The Vazirmatn column row puts its licence line and the centred `QuietButton` "Show licence text" (`<row>.show-text-button`) in the row's `textExtra` slot, where each part keeps its own width. Never use the wrapping `below` slot for it: that adds the row's 12 pt gap, every row grows 10 pt, and the tall capture's scroll offsets stop matching the design. Chevron rows are `end="chevron"` with `onPress`.

The template `use-licences-model.ts` (with its test) builds it: `[...shellLicenceEntries(t), ...creditRowsOf(useGameHost().credits)]`. The app bundles no licence documents and makes no request of its own, so `onShowText` hands the licence's public text to the browser (`licenceTextUrl` in settings-and-preferences' `config/external-links.ts`: the SPDX page, or the publisher's page for the Google SDK terms); a row without one (the game's own sounds) opens nothing (Chosen).

## Templates

Copy each file from `templates/` to the same path in the app repo; the code lives in `packages/shell/src/screens/settings/licences/`.

- `packages/shell/src/screens/settings/licences/licence-entries.ts`
- `packages/shell/src/screens/settings/licences/licences-view.tsx`
- `packages/shell/src/screens/settings/licences/licences-screen.tsx`
- `packages/shell/src/screens/settings/licences/licences-view.test.tsx`
- `packages/shell/src/screens/settings/licences/use-licences-model.ts` and its test

## testIDs

Exactly these, from the shared screen map (`assets/screen-testids.json`). Set the testID in the first column; the parts in the last column are drawn by that component from it. `<n>` is a stable data key (a level number, a language code, a stat id), never a list index; the only numbered series are the week columns and bars (`daily.week-day.1..7`, `stats.week-bar.1..7`: position, 1 = the oldest day, 7 = today), which WeekStrip and WeekBars number themselves. Components that take a base prop (`testIDBase`, `dayTestIDBase`, `barTestIDBase`, `segmentTestIDBase`) derive the rows marked "drawn by"; pass the base exactly (see component-contract.md). `node ${CLAUDE_SKILL_DIR}/scripts/list-screen.mjs S11d` prints every element with its English text.

Map note: Rows are keyed by the kebab-case component name; names and licences are never translated (text null).

| testID | Component (kind) | Role | Copy key | Variants, requires | Parts the component draws |
|---|---|---|---|---|---|
| `licences.screen` | ScreenFrame | none |  |  |  |
| `licences.top-bar` | TopBar | none |  |  | .back-button .title |
| `licences.intro` | AppText | text | `licences.intro` |  |  |
| `licences.group.fonts` | ListGroup | none |  |  | .tab .list |
| `licences.entry-row.vazirmatn` | ListRow (column row with description) | none |  |  | .label .description |
| `licences.entry-row.vazirmatn.licence` | AppText | text |  |  |  |
| `licences.entry-row.vazirmatn.show-text-button` | Button (quiet, chevron at the end) | button | `licences.show-text` |  |  |
| `licences.entry-row.lilita-one` | ListRow | button |  |  | .label |
| `licences.entry-row.lilita-one.licence` | AppText | text |  |  |  |
| `licences.entry-row.rubik` | ListRow | button |  |  | .label |
| `licences.entry-row.rubik.licence` | AppText | text |  |  |  |
| `licences.group.software` | ListGroup | none |  |  | .tab .list |
| `licences.entry-row.react-native` | ListRow | button |  |  | .label |
| `licences.entry-row.react-native.licence` | AppText | text |  |  |  |
| `licences.entry-row.react` | ListRow | button |  |  | .label |
| `licences.entry-row.react.licence` | AppText | text |  |  |  |
| `licences.entry-row.expo` | ListRow | button |  |  | .label |
| `licences.entry-row.expo.licence` | AppText | text |  |  |  |
| `licences.entry-row.react-native-skia` | ListRow | button |  |  | .label |
| `licences.entry-row.react-native-skia.licence` | AppText | text |  |  |  |
| `licences.entry-row.skia` | ListRow | button |  |  | .label |
| `licences.entry-row.skia.licence` | AppText | text |  |  |  |
| `licences.entry-row.react-native-reanimated` | ListRow | button |  |  | .label |
| `licences.entry-row.react-native-reanimated.licence` | AppText | text |  |  |  |
| `licences.entry-row.react-native-gesture-handler` | ListRow | button |  |  | .label |
| `licences.entry-row.react-native-gesture-handler.licence` | AppText | text |  |  |  |
| `licences.entry-row.formatjs-react-intl` | ListRow | button |  |  | .label |
| `licences.entry-row.formatjs-react-intl.licence` | AppText | text |  |  |  |
| `licences.entry-row.zustand` | ListRow | button |  |  | .label |
| `licences.entry-row.zustand.licence` | AppText | text |  |  |  |
| `licences.group.ads-store` | ListGroup | none |  |  | .tab .list |
| `licences.entry-row.react-native-google-mobile-ads` | ListRow | button |  |  | .label |
| `licences.entry-row.react-native-google-mobile-ads.licence` | AppText | text |  |  |  |
| `licences.entry-row.google-mobile-ads-sdk` | ListRow | button |  |  | .label |
| `licences.entry-row.google-mobile-ads-sdk.licence` | AppText | text |  |  |  |
| `licences.entry-row.expo-iap` | ListRow | button |  |  | .label |
| `licences.entry-row.expo-iap.licence` | AppText | text |  |  |  |
| `licences.group.sounds` | ListGroup | none |  |  | .tab .list |
| `licences.entry-row.game-sounds` | ListRow | button |  |  | .label |
| `licences.entry-row.game-sounds.licence` | AppText | text | `licences.entry.sounds-licence` |  |  |

## Copy keys

| Key | English |
|---|---|
| `common.back` | Back |
| `settings.licences.label` | Licences |
| `licences.intro` | {gameName} is built with these open-source components, fonts and sounds. Thank you to their authors. |
| `licences.group.fonts` | Fonts |
| `licences.entry.vazirmatn` | Font for Persian and Sorani text |
| `licences.show-text` | Show licence text |
| `licences.group.software` | Open-source software |
| `licences.group.ads-store` | Ads and purchase |
| `licences.group.sounds` | Sounds |
| `licences.entry.sounds-name` | Game sound effects |
| `licences.entry.sounds-licence` | Made in code for this game |

## Reference images

- `assets/reference/s11d-licences.png` (normal; phone-tall)

Open the image before building and compare the finished screen with it (toybox-visual-parity runs the exact comparison).

## Pitfalls

- Translating names or licence titles.
- Forgetting Lilita One and Rubik under Fonts.
- The licence line in `below`, regular-weight names, a nudge at the row start, or versions on Lilita One and Rubik: each moved or changed the rows against the design.
