# Rows and controls: behaviour, accessibility and copy

How each kind of S11 row behaves when touched and how VoiceOver reads it, plus every copy key the settings use. The pixel layout of S11 (groups, spacing, sizes) is the Toybox screen spec; this file is about what the rows do.

## Contents

- The S11 frame in one paragraph
- Toggle rows
- Segmented rows (Numbers, Theme)
- Volume sub-rows (slider)
- Chevron rows and danger rows
- The S11a language list
- Dialogs the rows open
- Copy keys
- Tests to write

## The S11 frame in one paragraph

Top bar "Settings" (`common.settings`) with the back button. The body scrolls under a fixed top bar, gap 20, seven groups; each group is a folder tab (`GroupTab`: pop fill, 16 pt icon, display-face label, it is a header) over a flat list (3 pt outline, radius 14, no shadow). Rows are at least 60 pt tall, padding 10 × 14, gap 12: icon tile 38 (pop paint; gold for Premium, danger paint for resets) · label 17 (+ description 14 muted) · end slot. Rows after the first have a 2 pt separator. Footer: 18 pt check + "Changes apply right away." and the version line. No banner. Owners of Premium see the "Premium – active" sticker row instead of "Remove ads".

## Toggle rows

- The whole row is the switch: `accessibilityRole="switch"`, `accessibilityState={{ checked }}`, the label is the accessible name, the description is the hint. The toggle graphic itself is decorative (not a separate target).
- Feedback: the switch's handler plays the toggle feedback (`ui.toggle` plus the `selection` pulse) right after it dispatches, through `onToggled` (use-settings-model.ts: `playUiFeedback(services, 'toggle')`), so turning Sound off is already silent and turning Vibration off does not buzz. `ListRow` plays no tap for a switch row, so a flip sounds once. Link rows and segments tap through their press host (`ListRow`, `RaisedSurface`); sliders play nothing while dragging.
- Toggle graphic: track 58 × 36 (radius 10, 3 pt outline), knob 26 × 26 with a 15 pt check (on) or dash (off); on = accent track, knob at the end (travels 22 pt, 300 ms boing; instant with Reduce motion). The check/dash is the non-colour cue.
- Tap: dispatch the row's action once (`onToggleSound`, `onToggleMusic`, `onToggleVibration`, `onToggleColorBlind`, `onToggleReduceMotion`, `onToggleHints`). A selection haptic may play (it obeys the Vibration setting itself).
- Reduce motion shows the resolved value (the explicit choice, or the phone's switch while the setting is `'system'`); tapping writes the opposite explicitly (`'on'`/`'off'`).
- Sound effects off does not hide its Volume sub-row; the slider is drawn "off" (fill in the muted ink).

## Segmented rows (Numbers, Theme)

- Wrap rows: the label line, then the control on a full-width line under it.
- The control is a radio group (`accessibilityRole="radiogroup"` on `settings.numbers-control` / `settings.theme-control`); each segment is `accessibilityRole="radio"` with `accessibilityState={{ selected }}`, testIDs `settings.numbers-segment.<automatic|latin|local>` and `settings.theme-segment.<system|light|dark>`.
- Exactly one segment is selected: accent fill, a 15 pt check before the label, pushed in (no shadow).
- Numbers previews: `digitPreviews[style]` = 123 formatted with `localeTagFor(language, style)`: in en/de all three show `123`; in fa/ckb Automatic and Local show `۱۲۳`, Latin shows `123`. Previews are formatted, never typed into catalogs.
- Tap: `onSelectDigits(style)` / `onSelectTheme(theme)`; selecting the current segment again does nothing visible (the reducer returns the same values).

## Volume sub-rows (slider)

- No separator, start padding 64 (lines up with the label above), label `settings.volume.label` 14 muted, then the slider (44 pt tall target, track 14 tall, thumb 30 × 30, fill from the start edge; right to left in fa/ckb).
- VoiceOver: `accessibilityRole="adjustable"`, `accessibilityValue={{ min: 0, max: 100, now: volume }}`, `accessibilityActions` increment/decrement in 10 % steps.
- The Toybox `Slider` works in 0..1 and calls `onChange` on every drag step: the row passes `value={volume / 100}` and, in its handler, rounds to integer percent and dispatches only when the percent differs from the saved one (at most one save per percent; a save write is well under 1 ms, p95 budget 5 ms). The reducer rounds and clamps anyway. Passing the percent straight to the Slider pins it at full and saves fractions: that is the most likely mistake here.
- testIDs: `settings.sound-volume-row` / `settings.sound-volume-slider`, `settings.music-volume-row` / `settings.music-volume-slider`.

## Chevron rows and danger rows

- `accessibilityRole="button"`; label is the name; the value (Language row) is read after it. Chevron flips in RTL.
- Language → `navigate('SettingsLanguage')`; Remove ads → `navigate('Premium')`; Privacy policy → `navigate('PrivacyPolicy')`; About → `navigate('About')`; Licences → `navigate('Licences')`; Restore purchase → the Premium service's restore (toasts report the result); Ad privacy choices → consent privacy form; Rate → store page; Contact → mail app.
- Danger rows (Reset statistics, Reset all progress): label in danger colour, bold; icon tile danger fill with danger edge; they open S14 dialogs, never act directly.

## The S11a language list

- One list: "System ({languageName})" with the description `language.system.description` and a radio mark, then one row per language with its autonym (18 pt bold, its own script and direction, `AppText language={code}`) and a radio mark. The chosen row's radio shows a check; `accessibilityRole="radio"` with `selected`.
- testIDs `settings-language.language-row.<system|en|de|fa|ckb>` (parts `.label`, `.description`, `.radio`).
- Choosing a row runs `planLanguageChange`; a direction flip opens the restart dialog. The note panel under the list says `language.direction-note`.

## Dialogs the rows open

| Dialog | Title / body keys | Buttons |
|---|---|---|
| Restart to apply (from S11a) | `settings.language.restart.title` / `.body` | Not now (secondary, `settings.language.restart.later`) · Restart now (primary, `settings.language.restart.confirm`) |
| Reset statistics | `dialog.reset-stats.title` / `.body` | danger block Reset (`dialog.reset-stats.confirm`) · Cancel |
| Reset all progress | `dialog.reset-progress.title` / `.body` | danger hold button (`dialog.reset-progress.confirm`, 2 s, `dialog.reset-progress.hold-hint`) · Cancel; VoiceOver gets an accessibility action instead of the hold |

The safe choice sits at the start (mirrors in RTL). The hold timer is functional: it keeps its 2 s under Reduce motion (`ReduceMotion.Never`).

## Copy keys

| Key | English |
|---|---|
| `common.settings` | Settings |
| `settings.group.language` / `.sound` / `.display` / `.premium` / `.privacy` / `.data` / `.about` | Language / Sound and feel / Display / Premium / Privacy / Data / About |
| `settings.language.label` | Language |
| `settings.language.system` | System ({languageName}) |
| `settings.numbers.label` / `.automatic` / `.latin` / `.local` | Numbers / Automatic / Latin / Local |
| `settings.sound-effects.label` | Sound effects |
| `settings.volume.label` | Volume |
| `settings.music.label` | Music |
| `settings.vibration.label` | Vibration |
| `settings.theme.label` / `.system` / `.light` / `.dark` | Theme / System / Light / Dark |
| `settings.colour-blind.label` / `.description` | Colour-blind friendly colours / Shapes and symbols, not just colour. |
| `settings.reduce-motion.label` / `.description` | Reduce motion / Less shaking, particles and bouncing. |
| `settings.hints.label` / `.description` | Hints during play / Tutorial tips and gentle nudges. |
| `settings.premium.remove-ads` / `.remove-ads-no-price` | Remove ads – {priceText} / Remove ads |
| `premium.active` | Premium – active |
| `common.restore-purchase` | Restore purchase |
| `settings.ad-privacy.label` / `.description` | Ad privacy choices / Change how Google may use data for ads. |
| `settings.privacy-policy.label` | Privacy policy |
| `settings.reset-stats.label` | Reset statistics |
| `settings.reset-progress.label` / `.description` | Reset all progress / Deletes levels, stars, daily results and statistics. |
| `settings.about.label` | About and credits |
| `settings.licences.label` | Licences |
| `settings.rate.label` | Rate this game |
| `settings.contact.label` | Contact support |
| `settings.autosave-note` | Changes apply right away. |
| `about.version` | Version {versionText} |
| `language.title` / `language.system.description` / `language.direction-note` | Language / Uses your phone’s language. / Persian and Sorani use a right-to-left layout. |
| `common.on` / `common.off` | On / Off |

All four languages (en, de, fa, ckb) exist for every key in the Shell catalogs; a missing key throws in tests.

## Tests to write

- Reducer: one example per action + the volume property (`settings-reducer.test.ts`).
- Store: persist-then-publish and clamping (`settings-store.test.ts`).
- Rows: visibility rules (`settings-rows.test.ts`).
- Handlers: each row sends its one action (`settings-preference-actions.test.ts`).
- Model hook: language value, digit previews, live update (`use-settings-model.test.tsx`).
- Effects: audio (`connect-audio-settings.test.ts`), language and digits (`localized-root.test.tsx`), reduce motion (`use-reduce-motion.test.ts`), language restart plan (`language-change.test.ts`).
- Screen: every row's testID renders and a toggle row press changes the store (the Settings screen test that goes with the Toybox screen).
