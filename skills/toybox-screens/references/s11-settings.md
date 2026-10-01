# S11 Settings

S11 Settings lists every preference in seven groups; every change applies at once, with no Save button.

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

- LANGUAGE: Language (System / English / Deutsch / فارسی / کوردیی ناوەندی; opens S11a); Numbers (Automatic / Latin 0-9 / Local ۰-۹).
- SOUND AND FEEL: Sound effects on/off + volume; Music on/off + volume (hidden if the game has no music); Vibration on/off (hidden on devices without vibration).
- DISPLAY: Theme (System / Light / Dark); Colour-blind friendly colours; Reduce motion (defaults to the phone's setting); Hints during play.
- PREMIUM: "Premium – active", or "Remove ads – €1.99" (price from the store) which opens S12; Restore purchase.
- PRIVACY: Ad privacy choices (reopens Google's consent form; only where that consent applies; Apple's tracking answer is changed in the phone's own Settings, never here); Privacy policy (S11c).
- DATA: Reset statistics (confirm); Reset all progress (confirm by holding 2 s). Keeps Premium, language and settings.
- ABOUT: About and credits (S11b); Licences (S11d); Rate this game (the store app handles it); Contact support (the phone's mail app).
- Every change applies immediately. A language change of direction shows "Restart to apply".

## Layout, top to bottom

Top bar "Settings" with Back. Body gap **20**: seven groups, each a group tab over a list, then the footer. No banner.

- **Group tab**: a pop folder tab flush with the list's start edge (marginStart 0), padding 4 / 12 / 5, a 2 pt edge on top and sides as rendered (token 2.5; a CSS border of 1 px or more renders floored), top radius 9, 16 pt icon, `groupTab` 15 display text; it sits on the list's top edge (overlap 0) and is a header.
- **List**: flat, 3 pt edge, radius 14, clips its rows. **Row**: min 60, padding 10 x 14, gap 12: icon tile 38 (pop) · label 17 (+ description 14 muted) · the end (value 15 muted + chevron 20, a toggle 58 x 36, or a radio). Rows after the first have a 2 pt separator on top. The whole row is the target.
- **Wrap rows** (Numbers, Theme): the segmented control drops to a full-width line under the label. Numbers segments show live previews (123 / 123 / ۱۲۳). The chosen segment is accent, pushed in, with a check.
- **Sub-rows** (volume under Sound effects and Music): no separator, start padding 64 (under the label), "Volume" 14 muted, then a slider (44 tall; fill from the start edge; inkSoft while that sound is off).
- **Danger rows** (Reset statistics, Reset all progress): label danger Bold, icon tile dangerFill with a danger edge.
- **Remove ads**: gold icon tile `crown`, label Bold with the store price ("Remove ads" offline): its row spec sets `isStrong` (`settings-row-specs.ts`), which `settings-row.tsx` passes to the Toybox `ListRow isStrong` (17 Bold, line height 1.32).

| Group (tab icon) | Rows in order |
|---|---|
| Language (`globe`) | Language (`globe`, value "System (English)" or the autonym) · Numbers (`hash`, wrap row) |
| Sound and feel (`sound`) | Sound effects (`sound`, toggle) · volume sub-row · Music (`music`, toggle) · volume sub-row · Vibration (`vibration`, toggle) |
| Display (`theme`) | Theme (`theme`, wrap row) · Colour-blind colours (`eye`, description, toggle) · Reduce motion (`motion`, description, toggle) · Hints (`hint`, description, toggle) |
| Premium (`crown`) | Remove ads (gold `crown`) · Restore purchase (`restore`) |
| Privacy (`shield`) | Ad privacy choices (`shield`, description) · Privacy policy (`doc`) |
| Data (`trash`) | Reset statistics (danger) · Reset all progress (danger, description) |
| About (`info`) | About and credits (`info`) · Licences (`doc`) · Rate this game (the hollow rating star, `icon: 'rating-star-hollow'` in `settings-row-specs.ts`: the design's `star(false)` with its 1.8 edge, never the 2.5-stroke `star-outline`; `SettingsRowSpec.icon` is an `IconTileIcon`, proven by `settings-row-specs.test.ts` and check-screens `rate-row-icon`) · Contact support (`mail`) |

Footer (column, start-aligned, gap 4, 14 muted, padding 0 / 4 / 8): an 18 pt check + "Changes apply right away." (6 pt between the icon and the text), then "Version 1.0.0 (8)" as one text (`about.version`, a normal word space, like every other label and value pair). The reference measures `settings.autosave-note` as the whole note row (icon plus text, 194.6 wide), so the testID sits on the row View, and both the note row and the version line are `alignSelf: 'flex-start'` (as wide as their content, never stretched to the column). The mockup once drew a 6 pt flex gap between "Version" and the number; that design artefact is corrected in the design itself (an intended reference change, recorded by toybox-visual-parity), so the version line needs no waiver.

## States and variants

- **Premium owners** (Chosen, not drawn): the Premium group shows one row with the gold "Premium – active" sticker (`settings.premium-active`) and keeps Restore purchase.
- Rows that do not apply are **hidden, never greyed**: Music without game music, Vibration without haptics, Ad privacy choices unless required, Remove ads for owners (`settingsGroupsFor()` decides; settings-and-preferences owns it).
- **No music** (Line Siege, whose six-sound bank has no `music` sound): the Music switch and the Music volume row are left out and the rows below close up (Vibration follows the Sound effects volume row). The design's S11 frame draws Music on, so visual parity compares such a game with the design-derived variant `s11-settings--no-music` (the two rows removed, the rest closed up exactly as the app lays them out), which the capture picks from `parity/game-facts.json` in the app repo (`hasMusic: false`). Never force the rows on to match the base frame, and never waive their absence.
- **Reduce motion row**: shows the saved choice (`isReduceMotionOn`, from `useReduceMotionSetting()`), also during a parity capture, where the screen's own animations (`isReducedMotion`, from `useReduceMotion()`) are frozen.
- **Reset all progress held** (parity frame `s14-reset-all-progress`): `use-settings-extras.ts` opens the reset dialog once on mount through the same handler the row uses, with `frozenProgress: 0.46` (the hold key 46 % full, as the design draws it); see s14-dialogs.md.

## Data the model supplies

`SettingsModel` from settings-and-preferences (`use-settings-model.ts`: values, visible groups and rows, the language value, digit previews, `isReduceMotionOn` (the row's saved value) and `isReducedMotion` (the screen's animations, frozen during a parity capture), preference actions; every switch plays the toggle feedback, `playUiFeedback(services, 'toggle')`, after its dispatch), fed by `useSettingsContext()` (settings-and-preferences): `hasMusic` = `useGameHost().hasMusic` (the game host says whether its sound bank has a `music` sound; no provider of its own), `canVibrate` from the haptics port, `isPrivacyOptionsRequired` from the saved consent answer, `isPremium`. Plus `SettingsExtras` (`settings-extras.ts`), built by the template `use-settings-extras.ts` (copy it with `use-settings-routes.ts`, `use-settings-links.ts` and their tests; every function stays within 40 lines):

| Field | Source |
|---|---|
| `removeAdsPriceText` | `priceOf(state.flow)` of the premium store (null offline or before the store answers) |
| `versionText` | `readVersionText()` (`app/read-version-text.ts`): expo-constants' `expoConfig.version` (`readAppVersion()`) and `expoConfig.ios.buildNumber`, "1.0.0 (8)"; a parity capture (test builds) uses `TEST_ONLY?.parityBuildNumber()` first, so the text matches the reference; expo-application is not in the dependency set |
| `onBack`, `onOpenLanguage`, `onOpenAbout`, `onOpenLicences`, `onOpenPrivacyPolicy`, `onOpenPremium` | `use-settings-routes.ts`: `navigation.goBack()` and `navigate('SettingsLanguage' \| 'About' \| 'Licences' \| 'PrivacyPolicy' \| 'Premium')`; in a partial Shell a route outside the slice shows `NotBuiltScreen`, never a no-op |
| `onRate`, `onContact` | `use-settings-links.ts`: `Linking.openURL` with `storeReviewUrl(extra.appStoreId)` (nothing until the game has an App Store id) and `supportMailUrl(extra.links.supportEmail, versionText)` from `config/external-links.ts` (settings-and-preferences; the one file allowed to hold URLs); a failed hand-off is logged |
| `onRestorePurchase` | `restorePremium(usePremiumScreenDeps().service).catch(service.onError)` |
| `onOpenAdPrivacy` | the consent port's `showPrivacyOptions()` (the row shows only where privacy options are required) |
| `onResetStats`, `onResetProgress` | `useOpenDialog()({ kind: 'reset-stats' \| 'reset-progress', onConfirm })` with `useSettingsResets()`'s `onConfirmResetStats` / `onConfirmResetProgress` (one `updateAndPublish` each); a parity capture of `s14-reset-all-progress` opens the reset-progress request once with `frozenProgress: 0.46` (`useParityOpener`) |

The route file is `const model = useSettingsModel(useSettingsContext()); const extras = useSettingsExtras(); return <SettingsView model={model} extras={extras} />`. Keep every handler synchronous (end promises with `.catch`).

Press feedback: link rows, segments and the language row play the tap feedback through the press hosts (`ListRow`, `RaisedSurface`); switch rows play only the toggle feedback (their handler), never both. Row testIDs come from `SETTINGS_ROW_TEST_IDS` in `settings-rows.ts`; `settings-row-specs.ts` gives each row its icon and copy keys; `settings-row-bindings.ts` its value and handler. Toybox wiring: `ListGroup` takes `title` and `icon` (the tab); switch rows are `ListRow` `end="toggle"` + `isOn` + `onPress`, link rows `end="chevron"`; Numbers and Theme are a `ListRow` whose `below` is a `SegmentedControl` (`testID` `settings.numbers-control`, `segmentTestIDBase="settings.numbers-segment"`, which derives each segment and its `.label` / `.preview`); the volume sub-rows are `SubRow` (derives `.label`) around a `Slider`.

## Templates

Copy each file from `templates/` to the same path in the app repo; the code lives in `packages/shell/src/screens/settings/*`.

- `packages/shell/src/screens/settings/settings-choice-row.tsx`
- `packages/shell/src/screens/settings/settings-extras.ts`
- `packages/shell/src/screens/settings/settings-footer.tsx`
- `packages/shell/src/screens/settings/settings-row-bindings.ts`
- `packages/shell/src/screens/settings/settings-row-specs.ts`
- `packages/shell/src/screens/settings/settings-row.tsx`
- `packages/shell/src/screens/settings/settings-view.tsx`
- `packages/shell/src/screens/settings/settings-volume-row.tsx`
- `packages/shell/src/screens/settings/settings-screen.tsx`
- `packages/shell/src/screens/settings/use-settings-extras.ts`, `use-settings-routes.ts`, `use-settings-links.ts`, with `use-settings-extras.test.tsx` and `use-settings-links.test.tsx`
- `packages/shell/src/app/read-version-text.ts` and its test
- `packages/shell/src/screens/settings/settings-view.test.tsx`
- From settings-and-preferences: `use-settings-model.ts`, `use-settings-context.ts`, `settings-rows.ts`, `settings-preference-actions.ts`, `use-settings-resets.ts` and `config/external-links.ts`, with their tests

## testIDs

Exactly these, from the shared screen map (`assets/screen-testids.json`). Set the testID in the first column; the parts in the last column are drawn by that component from it. `<n>` is a stable data key (a level number, a language code, a stat id), never a list index; the only numbered series are the week columns and bars (`daily.week-day.1..7`, `stats.week-bar.1..7`: position, 1 = the oldest day, 7 = today), which WeekStrip and WeekBars number themselves. Components that take a base prop (`testIDBase`, `dayTestIDBase`, `barTestIDBase`, `segmentTestIDBase`) derive the rows marked "drawn by"; pass the base exactly (see component-contract.md). `node ${CLAUDE_SKILL_DIR}/scripts/list-screen.mjs S11` prints every element with its English text.

| testID | Component (kind) | Role | Copy key | Variants, requires | Parts the component draws |
|---|---|---|---|---|---|
| `settings.screen` | ScreenFrame | none |  |  |  |
| `settings.top-bar` | TopBar | none |  |  | .back-button .title |
| `settings.group.language` | ListGroup | none |  |  | .tab .list |
| `settings.language-row` | ListRow | button |  |  | .icon .label .value |
| `settings.numbers-row` | ListRow (wrap row) | none |  |  | .icon .label |
| `settings.numbers-control` | SegmentedControl | radiogroup |  |  |  |
| `settings.numbers-segment.automatic` | SegmentedControl | radio |  |  | .label .preview (drawn by SegmentedControl from its `segmentTestIDBase`) |
| `settings.numbers-segment.latin` | SegmentedControl | radio |  |  | .label .preview (drawn by SegmentedControl from its `segmentTestIDBase`) |
| `settings.numbers-segment.local` | SegmentedControl | radio |  |  | .label .preview (drawn by SegmentedControl from its `segmentTestIDBase`) |
| `settings.group.sound` | ListGroup | none |  |  | .tab .list |
| `settings.sound-effects-switch` | ListRow | switch |  |  | .icon .label .toggle |
| `settings.sound-volume-row` | ListRow (sub-row) | none |  |  | .label |
| `settings.sound-volume-slider` | Slider | adjustable | a11y `settings.volume.label` |  |  |
| `settings.music-switch` | ListRow | switch |  |  | .icon .label .toggle |
| `settings.music-volume-row` | ListRow (sub-row) | none |  |  | .label |
| `settings.music-volume-slider` | Slider | adjustable | a11y `settings.volume.label` |  |  |
| `settings.vibration-switch` | ListRow | switch |  |  | .icon .label .toggle |
| `settings.group.display` | ListGroup | none |  |  | .tab .list |
| `settings.theme-row` | ListRow (wrap row) | none |  |  | .icon .label |
| `settings.theme-control` | SegmentedControl | radiogroup |  |  |  |
| `settings.theme-segment.system` | SegmentedControl | radio |  |  | .label (drawn by SegmentedControl from its `segmentTestIDBase`) |
| `settings.theme-segment.light` | SegmentedControl | radio |  |  | .label (drawn by SegmentedControl from its `segmentTestIDBase`) |
| `settings.theme-segment.dark` | SegmentedControl | radio |  |  | .label (drawn by SegmentedControl from its `segmentTestIDBase`) |
| `settings.colour-blind-switch` | ListRow | switch |  |  | .icon .label .description .toggle |
| `settings.reduce-motion-switch` | ListRow | switch |  |  | .icon .label .description .toggle |
| `settings.hints-switch` | ListRow | switch |  |  | .icon .label .description .toggle |
| `settings.group.premium` | ListGroup | none |  |  | .tab .list |
| `settings.remove-ads-row` | ListRow | button |  |  | .icon .label |
| `settings.restore-purchase-row` | ListRow | button |  |  | .icon .label |
| `settings.group.privacy` | ListGroup | none |  |  | .tab .list |
| `settings.ad-privacy-row` | ListRow | button |  |  | .icon .label .description |
| `settings.privacy-policy-row` | ListRow | button |  |  | .icon .label |
| `settings.group.data` | ListGroup | none |  |  | .tab .list |
| `settings.reset-stats-row` | ListRow (danger row) | button |  |  | .icon .label |
| `settings.reset-progress-row` | ListRow (danger row) | button |  |  | .icon .label .description |
| `settings.group.about` | ListGroup | none |  |  | .tab .list |
| `settings.about-row` | ListRow | button |  |  | .icon .label |
| `settings.licences-row` | ListRow | button |  |  | .icon .label |
| `settings.rate-row` | ListRow | button |  |  | .icon .label |
| `settings.contact-row` | ListRow | button |  |  | .icon .label |
| `settings.footer` | View | none |  |  |  |
| `settings.autosave-note` | AppText | text | `settings.autosave-note` |  |  |
| `settings.autosave-note.icon` | Icon (check 18) | none |  |  |  |
| `settings.version` | AppText | text | `about.version` |  |  |

Chosen states the design does not draw may also set: `settings.premium-active`, `settings.restore-purchase-row`.

## Copy keys

| Key | English |
|---|---|
| `common.back` | Back |
| `common.settings` | Settings |
| `settings.group.language` | Language |
| `settings.language.label` | Language |
| `settings.numbers.label` | Numbers |
| `settings.numbers.automatic` | Automatic |
| `settings.numbers.latin` | Latin |
| `settings.numbers.local` | Local |
| `settings.group.sound` | Sound and feel |
| `settings.sound-effects.label` | Sound effects |
| `settings.volume.label` | Volume |
| `settings.music.label` | Music |
| `settings.vibration.label` | Vibration |
| `settings.group.display` | Display |
| `settings.theme.label` | Theme |
| `settings.theme.system` | System |
| `settings.theme.light` | Light |
| `settings.theme.dark` | Dark |
| `settings.colour-blind.label` | Colour-blind friendly colours |
| `settings.colour-blind.description` | Shapes and symbols, not just colour. |
| `settings.reduce-motion.label` | Reduce motion |
| `settings.reduce-motion.description` | Less shaking, particles and bouncing. |
| `settings.hints.label` | Hints during play |
| `settings.hints.description` | Tutorial tips and gentle nudges. |
| `settings.group.premium` | Premium |
| `settings.premium.remove-ads` | Remove ads – {priceText} |
| `common.restore-purchase` | Restore purchase |
| `settings.group.privacy` | Privacy |
| `settings.ad-privacy.label` | Ad privacy choices |
| `settings.ad-privacy.description` | Change how Google may use data for ads. |
| `settings.privacy-policy.label` | Privacy policy |
| `settings.group.data` | Data |
| `settings.reset-stats.label` | Reset statistics |
| `settings.reset-progress.label` | Reset all progress |
| `settings.reset-progress.description` | Deletes levels, stars, daily results and statistics. |
| `settings.group.about` | About |
| `settings.about.label` | About and credits |
| `settings.licences.label` | Licences |
| `settings.rate.label` | Rate this game |
| `settings.contact.label` | Contact support |
| `settings.autosave-note` | Changes apply right away. |
| `about.version` | Version {versionText} |

## Reference images

- `assets/reference/s11-settings.png` (normal; phone-tall). This 1x copy was taken before the design dropped the version line's 6 pt gap; the measured comparison always uses toybox-visual-parity's current references, and a game without music is compared with its `s11-settings--no-music` variant.

Open the image before building and compare the finished screen with it (toybox-visual-parity runs the exact comparison).

## Pitfalls

- A second copy of the row list or its testIDs: use `settingsGroupsFor()` and `SETTINGS_ROW_TEST_IDS`.
- A Save button, or a local `useState` copy of a setting.
- Greying out rows that do not apply.
- A raised button inside a row, or shadows on rows and lists.
