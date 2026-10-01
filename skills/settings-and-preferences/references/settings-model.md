# The settings model, end to end

Every S11 setting: what the player sees, what is saved, which action changes it, its first-launch value, and the code that makes it do something. `scripts/check-settings.mjs` checks the saved fields, defaults, actions, rows and effects against this file.

## Contents

- Product rules (S11 and related spec)
- The saved fields
- First-launch defaults
- Actions and the store
- The row table
- The effects table
- Language and the direction restart
- Resets, Premium, privacy and links
- Changing or adding a setting
- When each file lands

## Product rules (S11 and related spec)

- Every change applies immediately; there is no Save button. Saved after every settings change, with the same safe write as every move.
- Language: System / English / Deutsch / فارسی / کوردیی ناوەندی (opens S11a). Changing the language switches the text at once. If the direction flips (English to Persian, say) the Shell shows "Restart to apply" and restarts itself with one tap. The save is untouched either way.
- Numbers: Automatic / Latin (0-9) / Local (۰-۹). One digit style for the whole app. Digits are display only; saves store plain numbers.
- Sound effects: on/off + volume. Music: on/off + volume, hidden if the game has no music, off by default (never over the player's own music). Vibration: on/off, hidden on devices without vibration.
- Theme: System / Light / Dark.
- Colour-blind friendly colours: on/off. Nothing is told apart by colour alone; shapes and symbols carry the meaning. (Toybox: the Shell palette is the same in both modes because every state already has a shape cue; the boards switch to their colour-blind board palette.)
- Reduce motion: on/off. Less screen shake, particles and bouncing. Defaults to the phone's own reduce-motion setting.
- Hints during play: on/off (tutorial tips and nudges).
- Premium: "Premium – active", or "Remove ads – {price}" (price from the store), which opens S12; Restore purchase.
- Privacy: Ad privacy choices (reopens Google's consent step; only where that consent applies; Apple's tracking answer is changed in the phone's Settings > Privacy & Security > Tracking, never in the game); Privacy policy (offline text, S11c).
- Data: Reset statistics (confirm). Reset all progress (confirm by holding for 2 seconds): deletes levels, stars, daily results and statistics; keeps Premium, language and settings.
- About: About and credits (S11b), Licences (S11d), Rate this game (the store app opens its page; the game makes no request), Contact support (the phone's mail app with address and version filled in).

## The saved fields

The settings section of the save document (valibot, strict object; `language: null` means "System"):

```ts
export const SETTINGS_V1 = v.strictObject({
  /** null = "System" (resolved against the device languages). */
  language: v.nullable(v.picklist(['en', 'de', 'fa', 'ckb'])),
  digits: v.picklist(['automatic', 'latin', 'local']),
  soundEnabled: v.boolean(),
  soundVolume: PERCENT,          // integer 0..100
  musicEnabled: v.boolean(),
  musicVolume: PERCENT,
  vibrationEnabled: v.boolean(),
  theme: v.picklist(['system', 'light', 'dark']),
  colorBlind: v.boolean(),
  reduceMotion: v.picklist(['system', 'on', 'off']),
  hintsDuringPlay: v.boolean(),
});

export const FIRST_RUN_V1 = v.strictObject({
  languageChosen: v.boolean(),
  tutorialDone: v.boolean(),
});
```

- Booleans keep data names (`soundEnabled`, `colorBlind`); code that destructures them renames to `is…` (`const { soundEnabled: isSoundOn } = settings`), as the naming lint requires.
- Volumes are integer percent in the save; the audio port takes 0..1, so the glue divides by 100.
- The section lives in the one save document written by `SaveService`; nothing else persists settings (no AsyncStorage, MMKV, SecureStore).
- The shape changes only through a new schema version with a migration and a frozen fixture (the save-persistence rules).

## First-launch defaults

```ts
export const DEFAULT_SETTINGS: SaveSettings = {
  language: null,          // System: follow the phone
  digits: 'automatic',     // the language's own digits
  soundEnabled: true,
  soundVolume: 80,
  musicEnabled: false,     // never over the player's own music
  musicVolume: 60,
  vibrationEnabled: true,
  theme: 'system',
  colorBlind: false,
  reduceMotion: 'system',  // follow the phone's switch
  hintsDuringPlay: true,
};
```

`firstRun` starts as `{ languageChosen: false, tutorialDone: false }`.

## Actions and the store

`packages/shell/src/stores/settings-reducer.ts` (template) is pure; `settings-store.ts` reduces, persists with `save.update` (sync, one transaction), then publishes with `set`. Persisting before publishing means the screen never shows a value that is not on disk.

| Action | Payload | Changes |
|---|---|---|
| `set-language` | `language: Language \| null` | `settings.language`, and `firstRun.languageChosen = true` |
| `set-digits` | `digits` | `settings.digits` |
| `set-sound` | `enabled, volume` | `soundEnabled`, `soundVolume` (rounded, clamped 0..100) |
| `set-music` | `enabled, volume` | `musicEnabled`, `musicVolume` (rounded, clamped) |
| `set-vibration` | `enabled` | `vibrationEnabled` |
| `set-theme` | `theme` | `settings.theme` |
| `set-color-blind` | `enabled` | `settings.colorBlind` |
| `set-reduce-motion` | `reduceMotion: 'system' \| 'on' \| 'off'` | `settings.reduceMotion` |
| `set-hints-during-play` | `enabled` | `settings.hintsDuringPlay` |
| `finish-tutorial` | none | `firstRun.tutorialDone = true` (idempotent) |

Selectors (`settings-selectors.ts`) return primitives or references already in the state: `selectSettings`, `selectLanguage`, `selectDigits`, `selectThemePreference`, `selectIsColorBlind`, `selectReduceMotionPreference`, `selectIsVibrationOn`, `selectHintsDuringPlay`, `selectIsFirstRun`, `selectNeedsLanguageChoice`, `selectDispatch`. A selector that builds an object goes through `useShallow` at the call site.

## The row table

Row ids and testIDs are in `templates/settings-rows.ts`; the handlers in `templates/settings-preference-actions.ts`.

| Group (tab icon) | Row | testID | Control | Field / action | Visible when |
|---|---|---|---|---|---|
| Language (`globe`) | Language | `settings.language-row` | value + chevron → S11a | `language` / `set-language` (in S11a) | always |
| | Numbers | `settings.numbers-row` + `settings.numbers-control` | segmented Automatic / Latin / Local with previews | `digits` / `set-digits` | always |
| Sound and feel (`sound`) | Sound effects | `settings.sound-effects-switch` | toggle (whole row is the switch) | `soundEnabled` / `set-sound` | always |
| | Volume | `settings.sound-volume-row` + `settings.sound-volume-slider` | slider, 10 % steps | `soundVolume` / `set-sound` | always (drawn "off" while sound is off) |
| | Music | `settings.music-switch` | toggle | `musicEnabled` / `set-music` | the game has music |
| | Volume | `settings.music-volume-row` + `settings.music-volume-slider` | slider | `musicVolume` / `set-music` | the game has music |
| | Vibration | `settings.vibration-switch` | toggle | `vibrationEnabled` / `set-vibration` | `HapticsPort.isSupported` (not iPad) |
| Display (`theme`) | Theme | `settings.theme-row` + `settings.theme-control` | segmented System / Light / Dark | `theme` / `set-theme` | always |
| | Colour-blind friendly colours | `settings.colour-blind-switch` | toggle + description | `colorBlind` / `set-color-blind` | always |
| | Reduce motion | `settings.reduce-motion-switch` | toggle + description, shows the resolved value | `reduceMotion` / `set-reduce-motion` | always |
| | Hints during play | `settings.hints-switch` | toggle + description | `hintsDuringPlay` / `set-hints-during-play` | always |
| Premium (`crown`) | Remove ads – {price} | `settings.remove-ads-row` | gold icon tile, bold label (its row spec sets `isStrong`, passed to `ListRow isStrong`), chevron → S12 | Premium store | not owned |
| | Premium – active | `settings.premium-active` | gold sticker row | Premium store | owned |
| | Restore purchase | `settings.restore-purchase-row` | chevron | Premium service `restore()` | always |
| Privacy (`shield`) | Ad privacy choices | `settings.ad-privacy-row` | description + chevron | consent port `showPrivacyOptions()` (Google's options form only; Apple's tracking answer is changed in the phone's Settings app, and the app never asks it again) | privacy options REQUIRED |
| | Privacy policy | `settings.privacy-policy-row` | chevron → S11c | none | always |
| Data (`trash`) | Reset statistics | `settings.reset-stats-row` | danger row → S14 reset-stats dialog | `resetStatistics` | always |
| | Reset all progress | `settings.reset-progress-row` | danger row + description → S14 hold dialog | `resetAllProgress` | always |
| About (`info`) | About and credits | `settings.about-row` | chevron → S11b | none | always |
| | Licences | `settings.licences-row` | chevron → S11d | none | always |
| | Rate this game | `settings.rate-row` | hollow-star icon tile, chevron | opens the store page | always |
| | Contact support | `settings.contact-row` | chevron | opens mail with address and version | always |

Footer: 18 pt check + `settings.autosave-note` ("Changes apply right away."), then `about.version`. No banner on S11.

Rows are hidden, never greyed out, when they do not apply. `settingsGroupsFor(context)` decides; `useSettingsContext()` gathers the context: `hasMusic` from `useGameHost().hasMusic` (the game host computes it from the game's sound bank; no provider or sounds context of its own, which a composition root could forget to mount), haptics support, the saved consent answer, Premium.

A game without music (Line Siege's six-sound bank has no `music` sound) hides the Music switch and its volume row; the rows below close up (Vibration follows the Sound effects volume row directly), and Pause leaves out its Music key the same way. The design's S11 and S6 frames draw Music, so visual parity compares such a game against the design-derived no-music variants (`s11-settings--no-music`, `s6-pause--no-music`): the capture picks the variant from `parity/game-facts.json` in the app repo (`hasMusic: false` for Line Siege, the same rule as `GameHost.hasMusic`). Never force the Music rows on to match the base reference, and never waive their absence.

The "Reduce motion" row shows and flips the saved choice (or the phone's switch while it says System): `useSettingsModel` reads `useReduceMotionSetting()` for `isReduceMotionOn`. The screen's own animations take `isReducedMotion` from `useReduceMotion()`, which is also true during a parity capture (a launch with `animations=off` freezes every loop and entrance); that freeze never reaches the row or the saved setting, so a captured S11 shows the row as the player saved it.

## The effects table

Each setting must change something outside the Settings screen. The checker looks for these readers.

| Field | Who applies it | How | When it takes effect |
|---|---|---|---|
| `language` | `app/localized-root.tsx` | `resolveLanguage(saved, getLocales())` → `I18nProvider language` | at once for text; a direction flip needs the restart (below) |
| `digits` | `app/localized-root.tsx` | `I18nProvider digits` → `localeTagFor(language, digits)` (`fa-u-nu-arabext` / `-latn`) | at once, every number |
| `theme` | `theme/theme-provider.tsx` | `resolveColorScheme(preference, useColorScheme())`; mirrors into `Appearance.setColorScheme(… 'unspecified')` so alerts and native forms match | at once |
| `colorBlind` | `theme/theme-provider.tsx` (Shell mode) and the board renderer (board palette) | theme `mode: 'colorBlind'`; boards pick their colour-blind board palette | at once |
| `reduceMotion` | `app/use-reduce-motion.ts`: `useReduceMotion()` (the setting, and always true during a parity capture) for animations; `app/use-reduce-motion-setting.ts`: `useReduceMotionSetting()` (`resolveReduceMotion(preference, isSystemOn)`, never frozen) for the Settings row | `<MotionConfig>` (Reanimated global), the navigator's fade, board timelines `'reduced'`, stickers, stars, confetti, the level flag, the busy blocks | at once |
| `soundEnabled`, `soundVolume` | `app/connect-audio-settings.ts` | store subscription → `audio.applySettings(toAudioSettings(settings))` (volume / 100) | at once |
| `musicEnabled`, `musicVolume` | `app/connect-audio-settings.ts`, Home | same subscription; switching off calls `audio.stopMusic()`; Home starts music on mount only when on and the game has music | at once |
| `vibrationEnabled` | composition root → haptics adapter | `createShellHaptics(settings, clock)` (the expo-haptics adapter with `isEnabled: () => selectIsVibrationOn(settings.getState())`), read at call time | next pulse |
| `hintsDuringPlay` | game host (teaching tips, nudges) | `useSettingsStore(selectHintsDuringPlay)` gates tutorial tips and hint nudges; the Hint button itself stays | next tip |

The vibration and hints effects ship as templates: `create-shell-haptics.ts` (`createShellHaptics(settings, clock)`, which reads only `settings.getState()` and only at pulse time) and `use-hints-during-play.ts` (the hook below), each with its test. Composition-root snippets (in `createShellApp`; the game host needs the haptics before the stores exist, so the settings are read through a lazy accessor):

```ts
const haptics = createShellHaptics({ getState: () => stores.settings.getState() }, clock);
// ... createGameHost(game, { ..., feedback: { audio, haptics } }), then the stores:
const stores = createShellStores(hydrated.save);
connectAudioSettings(stores.settings, audio); // returns the disconnect; the app lives as long as the process
```

```ts
// packages/shell/src/game-host/use-hints-during-play.ts
export function useHintsDuringPlay(): boolean {
  return useSettingsStore(selectHintsDuringPlay);
}
```

Never read the reduce-motion switch with Reanimated's `useReducedMotion()`: it is a constant captured at module load and ignores the Shell setting.

## Language and the direction restart

- S11a lists: "System ({languageName})" (`settings.language.system`, `languageName` = the autonym of the language the resolver would pick) with `language.system.description`, then English, Deutsch, فارسی, کوردیی ناوەندی (autonyms from `LANGUAGE_AUTONYMS`, never translated, each rendered in its own script with `AppText language={code}`). A radio mark shows the chosen one. A note panel says `language.direction-note`.
- `planLanguageChange({ next, deviceLocales, layoutDirection })` (template) returns the `set-language` action and `needsRestart` = the resolved language's direction differs from `readLayoutDirection()`.
- Dispatch the action (text switches at once). If `needsRestart`, open the S14 "Restart to apply" dialog (`settings.language.restart.*`): **Restart now** awaits `audio.dispose()` then calls the i18n layer's `restartForDirection(direction, guard)`; **Not now** keeps the current layout until the next cold start, whose startup check fixes it.
- Resolution: saved choice first; else the first device locale that is ckb (or `ku` in Arabic script), fa or prs (Dari), de, en; else English. `ku`/`kmr` in Latin script never map to ckb.
- `t()` isolates text placeholders with FSI … PDI (U+2068 … U+2069), so "System (English)" is really `System (⁨English⁩)`; tests compare with the marks.

## Resets, Premium, privacy and links

- **Reset statistics**: S14 dialog `dialog.reset-stats.*`, danger confirm → `onConfirmResetStats` (`settings-resets.ts`) = `updateAndPublish(save, stores, { recipe: resetStatistics, refreshBackup: true })`: the stats section only, one validated write, then every section store re-reads the document.
- **Reset all progress**: S14 hold-to-confirm dialog (2 s, `dialog.reset-progress.*`) → `onConfirmResetProgress` = `updateAndPublish(save, stores, { recipe: resetAllProgress, refreshBackup: true })`: levels, stars, run, daily, statistics, hints, upsell. It keeps `settings`, `firstRun`, the ads consent and caps, and `premium` (never reset). A parity capture of the design's `s14-reset-all-progress` frame (test builds) opens the same dialog once on mount, from the S11 model hook that owns the row's handler (toybox-screens' `use-settings-extras.ts`, through `useParityOpener('reset-progress-dialog-held', ...)`), with `frozenProgress: 0.46` in the dialog request: the hold key shows 46 % full, as the design draws it, and a press neither fills nor confirms.
- Why `updateAndPublish` and never a bare `save.update(...)`: the disk would be right, but the progress and stats stores would keep their old sections, so Home, Levels, Daily and S10 show the old stars and numbers until the next start. `refreshBackup: true` makes the reset stick (a later backup restore cannot undo it). `useSettingsResets()` binds both handlers to the app's save (`useServices().save`) and stores (`useStores()`); the dialog host passes them as the dialogs' `onConfirm`. `check-settings.mjs` reports `reset-publish` for a bare write or a reset that is never written.
- **Premium rows**: "Remove ads – {priceText}" with the store price (`settings.premium.remove-ads`), `settings.premium.remove-ads-no-price` when the price is unknown (offline); owners see the "Premium – active" sticker row (`premium.active`) and keep Restore purchase. Premium is never pushed with pop-ups.
- **Ad privacy choices**: shown only when the saved consent answer has `isPrivacyOptionsRequired`; calls the consent port's privacy-options form; the ads service then refreshes `canRequestAds`.
- **Rate this game / Contact support**: `Linking.openURL` with the URLs from `packages/shell/src/config/external-links.ts` (template `external-links.ts`, the only file allowed to hold URLs): `storeReviewUrl(appStoreId)` (null until the game has an App Store id: the row then does nothing), `supportMailUrl(supportEmail, versionText)` with the version "1.0.0 (8)" in the subject. The same file gives `privacyPolicyUrl(links)` (the published policy the stores and AdMob need) and `licenceTextUrl(licence)` (S11d). toybox-screens' `use-settings-links.ts` calls them; a failed hand-off is logged, never shown.

## Changing or adding a setting

1. Decide it with the owner (it is a product change) and add its row to the tables above.
2. New schema version + migration + frozen fixture (save-persistence rules); add the field and default.
3. Add the action to the reducer (one test per action) and a selector.
4. Add the row id and testID to `settings-rows.ts` (and the design contract if it is new UI), its handler, and its effect.
5. Update `FIELDS` / `ACTIONS` in `scripts/check-settings.mjs`, then run it and the self-test.

## When each file lands

In a Shell built step by step a file lands at the first step whose code imports it, together with its test, so `tsc`, `check:fast` and `test:coverage` stay green after every step. Paths are under `packages/shell/src/`.

| Step | Files (each with its test where it has one) | Why then |
|---|---|---|
| Shell step 5 (state-stores) | `stores/settings-reducer.ts`, `stores/settings-selectors.ts`, `stores/settings-store.ts` | the services and stores step; shared copies, the same bytes as state-stores ships |
| Shell step 7, with the composition root, whatever the slice | `app/connect-audio-settings.ts`, `app/create-shell-haptics.ts`, `app/localized-root.tsx`, `config/external-links.ts`; and, if not yet copied by toybox-design-system and react-components-and-hooks, the shared `theme/theme-provider.tsx`, `app/use-reduce-motion.ts`, `app/use-reduce-motion-setting.ts` | game-host-integration's `create-shell-parts.ts` and `shell-app.tsx` import them (the audio glue, the haptics port, the localized root, the external links) |
| The first screen that imports it (Shell step 9) | `screens/settings/settings-preference-actions.ts` with S5 (the Game screen draws the S6 Pause overlay, so S5, S6 and S7 land together); `screens/settings/settings-resets.ts` and `screens/settings/use-settings-resets.ts` with S10 Statistics (its reset); `screens/settings/language/language-change.ts` with S11a | borrowed by screens built before S11; toybox-screens' screen table lists them in its Borrows column, and its `check-screens.mjs . --screen <id>` names a missing one with this skill as its owner (`borrowed-file`) |
| S11 | `screens/settings/settings-rows.ts`, `use-settings-model.ts`, `use-settings-context.ts`, `game-host/use-hints-during-play.ts` | the S11 screen and its model |

A file without a test of its own (`use-settings-resets.ts`) is covered by the tests of the screen that brings it.

