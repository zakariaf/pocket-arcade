# The common frame and the rules every screen follows

Everything a Pocket Arcade screen shares: where each screen's code lives, the Toybox frame, the layout numbers, the testID and copy-key contract, the model/view pattern, right to left, dark, large text, and the reference images.

## Contents

- The screens and where they live
- The common frame
- Layout numbers
- Screen rules (with the reason for each)
- The testID contract
- Copy keys and texts
- The model/view pattern
- A partial Shell (shell-slice.json)
- Right to left
- Dark theme
- Large text (200 %) and small or wide windows
- Accessibility
- Reference images
- Values the design leaves open (Chosen)

## The screens and where they live

| Spec | Screen | How it shows | Code (app repo) | Reference |
|---|---|---|---|---|
| S1 | Splash | native splash; `StartupSplash` during a direction restart | `packages/shell/src/app/startup-splash.tsx` | [s01-splash.md](s01-splash.md) |
| S2 | First-run language choice | route `LanguageChoice` (FirstRun) | `packages/shell/src/screens/first-run/` | [s02-language-choice.md](s02-language-choice.md) |
| S3 | Consent moment | full screen before Google's form, not a route | `packages/shell/src/screens/consent/` | [s03-consent.md](s03-consent.md) |
| S4 | Home | route `Home` | `packages/shell/src/screens/home/` | [s04-home.md](s04-home.md) |
| S5 | Game (the assembled screen: session, top bar, board slot, Pause and Result overlays, paid perks, result keys) | route `Game` | `packages/shell/src/screens/game/` and `packages/shell/src/game-host/game-top-bar.tsx` (the host's props drawn with the Toybox `GameTopBar`) | [s05-game.md](s05-game.md) |
| S6 | Pause | overlay inside Game | `packages/shell/src/screens/pause/` | [s06-pause.md](s06-pause.md) |
| S7 | Result | overlay inside Game | `packages/shell/src/screens/result/` | [s07-result.md](s07-result.md) |
| S8 | Levels | route `Levels` | `packages/shell/src/screens/levels/` | [s08-levels.md](s08-levels.md) |
| S9 | Daily challenge | route `Daily` | `packages/shell/src/screens/daily/` | [s09-daily.md](s09-daily.md) |
| S10 | Statistics | route `Stats` | `packages/shell/src/screens/stats/` | [s10-statistics.md](s10-statistics.md) |
| S11 | Settings | route `Settings` | `packages/shell/src/screens/settings/` (files, not subfolders) | [s11-settings.md](s11-settings.md) |
| S11a | Language | route `SettingsLanguage` | `packages/shell/src/screens/settings/language/` | [s11a-language.md](s11a-language.md) |
| S11b | About and credits | route `About` | `packages/shell/src/screens/settings/about/` | [s11b-about.md](s11b-about.md) |
| S11c | Privacy policy | route `PrivacyPolicy` | `packages/shell/src/screens/settings/privacy/` | [s11c-privacy-policy.md](s11c-privacy-policy.md) |
| S11d | Licences | route `Licences` | `packages/shell/src/screens/settings/licences/` | [s11d-licences.md](s11d-licences.md) |
| S12 | Premium | route `Premium` | `packages/shell/src/screens/premium/` | [s12-premium.md](s12-premium.md) |
| S13 | How to play | route `HowToPlay` | `packages/shell/src/screens/how-to-play/` | [s13-how-to-play.md](s13-how-to-play.md) |
| S14 | Dialogs | the dialog host above the navigator | `packages/shell/src/screens/dialogs/` and `packages/shell/src/app/crash-screen.tsx` | [s14-dialogs.md](s14-dialogs.md) |
| S15 | Debug menu | route `Debug`, test builds only | `packages/shell/src/screens/debug/` | [s15-debug.md](s15-debug.md) |

`check-screens.mjs` uses exactly these folders. Folder chosen here, not by the design (Chosen): S3 in `screens/consent/`, S14 dialogs in `screens/dialogs/`.

## The common frame

The design phone is 390 x 844 pt with a 54 pt status bar and a 34 pt home-indicator zone (the real safe areas apply on each phone; the iPhone 16 Pro used for parity is 402 x 874 with a 62 pt top). Unless a screen says otherwise:

- **Ground** fills the whole screen, behind the status bar too: `ScreenFrame` (react-components-and-hooks) paints it and applies the safe areas (`edges`, all four by default).
- **Top bar** (`TopBar`) directly under the status bar: min 66, padding 4 top / 16 inline / 8 bottom, gap 12; the back icon button (48, label `common.back`, the arrow mirrors in RTL) at the start, the title (`topBarTitle` 27, a header) in the middle, at most one end action. Home replaces back and title with the brand lock; S2, S3, S1, the overlays and the dialogs have no top bar.
- **Body** (`ScreenBody`, template `ui/screen-body.tsx`): padding 6 top, 20 inline, 34 bottom (the home-indicator zone; `ScreenBody` tops the safe-area inset up to 34), and one **gap** between blocks: 14 by default, **20** on Settings, **18** on Privacy policy and Licences, **16** on Statistics.
- **Tall pages without a banner scroll on under the home indicator.** The references draw such a page's body continuing under the home indicator at scroll 0 and ending with the 34 pt page padding at the bottom of the scroll. Those screens pass `edges={UNDER_HOME_INDICATOR_EDGES}` (`['top', 'left', 'right']`, from `ui/screen-frame.tsx`) to `ScreenFrame` and `isUnderHomeIndicator` to `ScreenBody` (content `paddingBottom` = max(34, bottom inset)): **S10 while its banner is not allowed, S11, S11a, S11b, S11c, S11d and S15**. Screens with a banner slot (S4, S8, S10 with its banner) keep all four edges: the inset sits under the pinned banner. Without this the body is clipped 34 pt above the screen bottom (S11's theme segments were cut at y 840).
- **A tilted first block needs overhang room.** A scroll view clips its content at its top edge; S4's tagline sticker (tilted -2 deg, with a 3.5 pt die-cut ring) rises about 8 pt above its box, so its corner was cut flat. `ScreenBody hasTopOverhang` starts the scroll view 10 pt higher and pads its content 10 pt more: nothing moves but the clip edge. Home sets it while the tagline shows.
- **Opening at a scroll offset.** `ScreenBody scrollToY` (or, in test builds, the parity harness's `ScreenScrollTargetContext`) scrolls from both `onContentSizeChange` and `onLayout`: the scroll view's first layout happens before the safe-area insets arrive, its frame is too tall and iOS clamps the offset; the later layout (same content size) scrolls again. A harness that scrolls only in `onContentSizeChange` stops short (S11 stuck at 1104.7 instead of 1170).
- **"grow"** is a flexible spacer (`flexGrow: 1`) that pushes what follows to the bottom (the hero key). The body is a ScrollView whose content grows, so the same column scrolls at 200 % text instead of clipping.
- **Long screens** (S10, S11, S11c, S11d, S15) scroll; the top bar stays fixed and only the body scrolls; the banner stays pinned under the scroll.
- **Tablets and wide windows**: the column is centred and at most 640 pt wide (`ScreenFrame`); nothing else changes.

## Layout numbers

From the Toybox tokens (`assets/toybox-tokens.json`: `layout`, `spacing`, `radii`, `stroke`, `elevation`, `components`), all as code constants in `theme/tokens.ts` (toybox-design-system):

| What | Value | Constant |
|---|---|---|
| Screen gutter / block gap | 20 / 14 | `LAYOUT.screenGutter`, `LAYOUT.blockGap` |
| Body padding top / bottom | 6 / 34 | `LAYOUT.bodyPaddingTop`, `LAYOUT.bodyPaddingBottom` |
| Top bar inline padding (game top bar) | 16 (14) | `LAYOUT.topBarPaddingInline`, `LAYOUT.gameTopBarPaddingInline` |
| Settings / long page / Statistics gap | 20 / 18 / 16 | `LAYOUT.settingsGroupGap`, `.longPageGap`, `.statsPageGap` |
| Inside panels | padding 14 x 16; small stat panels 12 x 14; rows 10 x 14; gap 12 | `LAYOUT.panelPaddingBlock/Inline` |
| Radii | 14 buttons, panels, lists, option cards; 10 tiles, segments, toggles; 22 dialogs, Premium art; never a pill | `RADII` |
| Strokes | 3 controls and panels; 2 tiles, stickers, chips, icon tiles (token 2.5, drawn 2 as rendered: `STROKE.tile`); 2 separators | `STROKE` |
| Hard shadow (elevation) | 3 tiles and segments; 4 icon buttons; 5 buttons, keys, option cards; 6 the hero key; 8 dialogs; panels 0 | `ELEVATION` |
| Touch target | at least 44 x 44 pt | `MIN_TOUCH` |
| Two side-by-side buttons | gap 12; keys and pause keys gap 10 | `usePairLayout(12)`, `usePairLayout(10)` |
| Dialog overlay | padding 28 block / 20 inline; dialog padding 22 / 20 / 20, gap 12; button row 6 pt extra top margin | component constants |

Type roles: `display` 38, `title` 30, `number` 30, `heading` 21 (Lilita One; Vazirmatn Bold in fa/ckb) and `body` 17, `label` 17 Bold, `caption` 13 (Rubik; Vazirmatn), plus the component styles (`topBarTitle`, `heroKeyLabel`, `gameNameHome`, `rowLabel`, `statLabel`, …) that `AppText` takes as `variant`. Never a raw font size.

## Screen rules (with the reason for each)

1. **Start-align.** Screens read from the start edge. Only S1's content, the S7 chip, stars, titles, sub-sticker and lose picture, the Pause "Home" link, the quiet nudges under a hero key and the S3 Google sheet are centred. Centred menus are what Toybox avoids.
2. **One hero key per screen.** The 80 pt key appears at most once; everything else is a 54 pt button, row or key. It is the one obvious "go".
3. **Accent means "go"; destructive never looks like accent.** Danger buttons keep the surface fill and turn their text, icon and edge danger; danger text sits only on surface (on the light ground it fails contrast).
4. **Raised means pressable.** Buttons, keys, tiles and segments cast a hard shadow and sink when pressed; panels, lists, rows, chips, toasts and stickers lie flat. Never make a whole panel pressable; put a button in it.
5. **Stickers carry news, and only stickers tilt** (2–8 degrees; logos and art tiles too). Body text never rotates.
6. **Shape before colour.** Every state has a non-colour cue (check or dash in toggles, a check in the chosen segment and option, dashed edge plus padlock on locked tiles, filled vs hollow stars, icons in week marks), so the colour-blind palette can equal the standard one.
7. **Banner only on Home, Levels and Statistics**, pinned at the bottom, gone for Premium owners, zero height until an ad loads. Never on Game, Pause, Result, dialogs or Premium (spec N8, 8.8). `check-screens.mjs` enforces it.
8. **Colours only from the theme** (`theme.colors`, `SHELL_COLORS`), sizes only from tokens and component constants; no colour literals in screens (lint enforces).
9. **Every tappable target at least 44 x 44 pt**; rows are the whole target (a toggle row is the switch).
10. **Reduce motion**: every animation has its alternative (press without squash, stars shown at once, no bobbing or hopping, fades); the hold-to-confirm timer keeps its 2 s.

## The testID contract

The owner's rule: every screen uses **exactly** the testIDs in `assets/screen-testids.json` (the library's shared map; E2E flows and the visual-parity harness find elements by them).

- Shape: `<scope>.<element>[.<part-or-key>…]`, every segment kebab-case, at least two segments. The scope is the route in kebab-case (`home`, `settings-language`), an overlay (`pause`, `result`), a dialog (`<name>-dialog`), `splash` or `consent`.
- Interactive elements end in their role: `-button`, `-switch`, `-slider`, `-row`, `-tile`, `-card`, `-segment`.
- **Repeated items append a stable data key, never a list index**: `levels.level-tile.12`, `settings-language.language-row.fa`, `licences.entry-row.react-native` (kebab component name), `stats.game-card.monsters-defeated` (kebab stat key). The one numbered series is a week: `daily.week-day.1..7` and `stats.week-bar.1..7` count the last seven days by position (1 = the oldest, 7 = today); WeekStrip and WeekBars number them, the model only orders the days.
- **Parts**: a Toybox component takes one testID (or a base prop) and draws its parts by appending a segment; the screen passes only that id. From `testID`: `ListRow` → `.icon .label .description .value .toggle .radio`; `SubRow` → `.label`; `ToggleKey` → `.icon .label .state`; `RowButton` → `.icon .label .description`; `TopBar` → `.back-button .title`; `ListGroup` → `.tab .list`; `OptionCard` → `.label .radio`; `NotePanel` → `.icon .label`; `Slider` and `HoldButton` → `.fill`; `CalendarTile` → `.month .day`; `WeekLegend` → `.done .missed`; `LevelTile` → `.number .stars-<k> .flag`; `PagerDots` → `.1`…`.n`. From a base prop: `DialogCard testIDBase` → `.card .title .body`; `GameTopBar testIDBase` → `.top-bar .pause-button .mode-label .progress-label .score .undo-button .hint-button`; `ScorePanel testIDBase` → `.label .value .new-best .progress-line`, and `.moves-line` or `.score-line` from its `line` kind; `EmptyState testIDBase` → `.picture .title .body`; `StatGrid testIDBase` → `<base>.<cell id>` with `.value .label`; `StatList testIDBase` → `.list` and `<base>.<row id>` with `.label .value`; `SegmentedControl segmentTestIDBase` → `<base>.<value>` with `.label .preview`; `WeekStrip dayTestIDBase` → `<base>.<n>` with `.letter .mark .today-tag`; `WeekBars barTestIDBase` → `<base>.<n>` with `.value .bar .day`. A few parts no component draws are set by the screen itself: the licence line and "Show licence text" of S11d rows (through ListRow's `below` slot), the `.icon` wrappers of the 18 and 22 pt stars (RatingStar takes no testID), `<dialog>.scrim` and `<dialog>.art`. The full prop list is [component-contract.md](component-contract.md).
- Put the testID on the **accessible element** (the Pressable, the switch row); Maestro cannot see inside an accessible element. The Toybox components hide their purely decorative parts from VoiceOver (icon tiles, art tiles, the calendar tile, logo tiles, pager dots, radio marks, toggle graphics, confetti, unlabelled stars and marks); a screen never adds `accessibilityElementsHidden` itself, and never removes it to make a part measurable. RNTL skips hidden elements by default, so a view test that checks every design testID queries with `getByTestId(id, { includeHiddenElements: true })`, and uses roles for what VoiceOver must reach.
- **One policy for VoiceOver and parity (the map's reach).** Maestro's hierarchy lists what VoiceOver can reach, so only those elements are bounds-checked: the screen root, containers, texts and accessible elements. Parts inside an accessible element (`parent`) and decorative parts hidden from VoiceOver (`a11yHidden: true`) are **crop-only**: their `checks` are `["crop"]` and `coveredBy` names the reachable ancestor whose aligned crop judges their pixels (a missing or wrong logo fails as a `structure` difference of `home.screen`, "inside its crop-only part home.logo"). They still carry their testIDs (tests and E2E flows use them); `list-screen.mjs` prints each id's parity reach.
- `variants`: the element exists only in those states. `requires: endless` = only games with Endless; `no-endless` = the opposite; `game:<id>` = that game's own key (other games use their own keys in the same place).
- **Chosen, not drawn**: the map's `notDrawn` list names testIDs for states the design leaves out (the daily "done" line, the daily and endless results, the restart-level, reset-statistics and newer-save dialogs, the crash screen, the Premium-owner Settings row). They are allowed; no other new testID is.
- A testID the design truly needs but the map lacks is a map change: ask for it (the library owns the map); never invent one in code. `check-screens.mjs` fails on unknown, missing and borrowed testIDs.

## Copy keys and texts

- Every visible string and every accessibility label comes from `t('<key>')` with a copy-deck key (`assets/copy-deck.json`); the key names the place, never the words. Each screen reference lists its keys with the English text.
- Free-text placeholders end in `Name` or `Text` (`{gameName}`, `{priceText}`, `{dateText}`) and arrive bidi-isolated (FSI … PDI); in tests match them with a pattern, not an exact string.
- Numbers are typed ICU arguments (`{level, number}`); pass numbers, not formatted strings, where the key has a number placeholder. Stand-alone numbers (stat values, scores, level numbers) come from the model already formatted with the chosen digits.
- Dates come from the Shell date formatter in the model (`date.weekday-day-month` and friends), never `toLocaleDateString` or `Intl.DateTimeFormat`.
- Game texts (deck keys `games.<id>.*`, catalog keys `<game-id>.<kebab-field>`: name, tagline, goal, progress, win-title, stats, how-to-play, pack names, and one `<game-id>.lose.<reason>` key per way of losing, for example `line-siege.lose.broke-through` and `line-siege.lose.board-full`; the deck's `loseReason` is the first of them, and `<id>.lose-reason` / `<id>.result.*` are retired) come from the game module through the game host and the model: `gameMessageText(t, { id })` with the ids the host hands over (`host.nameId`, `host.taglineId`, `host.winTitleId`, the hud goal, counter labels, pack names), never a key the Shell builds. Game names stay Latin in every language and render in Lilita One.
- The mode line ("Level 12", "Daily – 26 Sep", "Endless") is formatted by the game host (`game-screen.mode.*`, `modeTextOf`) and handed to the Game top bar, Pause and Result.
- A Shell text the deck lacks is written by hand in all four Shell catalogs with exactly the texts its screen reference gives (fa and ckb marked for a native speaker's review); `check-screens.mjs` fails `extra-key-catalog` while a catalog lacks it. Today: `result.win.score-line` (S7, the win line of a score-rated level: "Score {score, number} – best {bestScore, number}") and the undo and hint keys' labels `game-screen.undo-button.a11y-label` and `game-screen.hint-button.a11y-label` (S5). `result.win.moves-count` is retired (`retired-copy-key`). The deck itself is never edited.

## The model/view pattern

Every screen is three small pieces (templates show each one):

- `<name>-screen.tsx`: the route component: `const model = use<Name>Model(); return <<Name>View model={model} />`. Nothing else. Its second line is the `// device-only: covered by <the e2e flow or simulator capture that opens it>; ...` marker: it only joins the tested hook and the tested view, so the coverage and test gates skip it.
- `<name>-view.tsx` (or `-page`, `-overlay`): pure layout. Takes a typed `model`, calls `useT()` for the static copy, and sets every testID. No store, no navigation, no service.
- `<name>-model.ts` or the `…Model` type in the view file: the data and handlers the view needs. `use-<name>-model.ts` (a template, with its test) builds it from the stores with selectors (state-stores), formats numbers and dates, and wires navigation (navigation-and-routing) and services. It is the only code that reads stores, services, the game host and navigation. Each function stays within 40 lines, so a big model is split (`use-home-actions.ts`, `use-settings-routes.ts`, `use-settings-links.ts`) and pure parts become tested functions (`levels-model-of.ts`, `stats-snapshot-of.ts`).

| Screen | Model hook (template) | What it reads |
|---|---|---|
| S2 | `use-language-choice-model.ts` | the phone's languages (expo-localization), the settings store; `createLanguageT` for Continue; `useDirectionRestart` when the direction flips |
| S4 | `use-home-model.ts` (+ `use-home-actions.ts`, `use-level-play.ts`) | `useGameHost()` (logo, name, tagline), `useGameExtra()` (level count, Endless), `save.doc().run?.ref` of kind `level` (Continue), the progress and premium stores, `useDailySummary()`, `useBannerSlot('home')`, the test build's perf log for the cold-start mark |
| S5 | `use-game-screen-model.ts` (+ `use-run-text.ts`, `use-perk-payment.ts`, `use-result-actions.ts`, `use-result-extras.ts`) | the Game screen's controls, `useGameHost()`, `useGameExtra().hints.freePerDay`, the ads port and policy, the progress and premium stores, `useReduceMotion()` |
| S6 | `use-pause-model.ts` | the Game screen's controls (`session`: the run's ref and move count, `startRun`), the settings store and its actions, `useGameHost().hasMusic`, haptics support, `useOpenDialog()` |
| S8 | `use-levels-model.ts` (+ `levels-model-of.ts`) | `useGameHost().packs`, the progress store's stars, the chosen digits, `useBannerSlot('levels')` |
| S9 | `use-daily-model.ts` | `useDailySummary()`, `useNextDayCountdown()`, the date formatter |
| S10 | `use-stats-model.ts` (+ `stats-snapshot-of.ts`) | `useStatsSummary()` with `useGameExtra()` and `useGameHost().counters` (save key and label), `useBannerSlot('stats')`, the reset-statistics dialog, `useLevelPlay()` |
| S11 | `use-settings-extras.ts` (+ `use-settings-routes.ts`, `use-settings-links.ts`) next to `useSettingsModel(useSettingsContext())` | the premium store's price, `readVersionText()`, navigation, the consent port, Restore, the reset dialogs, Rate and Contact hand-offs; Music rows from `useGameHost().hasMusic` |
| S11a | `use-settings-language-model.ts` | the settings store, `planLanguageChange`, the restart-to-apply dialog |
| S11b | `use-about-model.ts` | `useGameHost()`, `readVersionText()`, `useGameExtra().links.supportEmail`, Contact |
| S11c | `use-privacy-policy-model.ts` | the game name, the support address, the policy's last-change date |
| S11d | `use-licences-model.ts` | `shellLicenceEntries(t)` then `creditRowsOf(host.credits)`; the licence text hand-off |
| S12 | `use-premium-model.ts` | the premium store and service (`PremiumScreenDepsProvider`), connectivity |
| S13 | `use-how-to-play-model.ts` | `useGameHost().howToPlayPages` and `renderHowToPlayPicture` |
| S15 | `use-debug-model.ts` (e2e-maestro); `use-font-test-model.ts` (the font test page) | the debug services; the type styles and the four language samples |

Hook tests use `renderHook` with `createHostWrapper()` (`testing/create-host-wrapper.tsx`: the Shell providers of `renderWithShell`, a real `createGameHost` over the tally test game with its texts, and `host` overrides such as `{ hasMusic: true }`) or, for hooks that never read the host, `createShellWrapper()`. Navigation and the dialog opener are mocked per test (`jest.mock('@react-navigation/native', ...)`, `jest.mock('@e07/shell/app/dialog-context.tsx', ...)`), and `expo-constants` with `TEST_EXPO_CONSTANTS` (`testing/test-game-extra.ts`). `check-screens.mjs` fails a route file that calls no model hook (`route-model-hook`), imports a hook that does not exist (`model-hook-missing`) or one without its test (`model-hook-test`).

Views are tested by rendering them through `renderWithShell` with an example model: every testID of the screen is found (with `{ includeHiddenElements: true }`, because the components hide their decorative parts), each handler fires, and **every test that renders** (each state and variant is its own screen for VoiceOver) ends with `expect(findInaccessiblePressables(screen.container)).toStrictEqual([])` (`@e07/shell/testing/find-inaccessible-pressables.ts`); `check-screens.mjs` fails a view-test block without it. Overlays that cover the game set `accessibilityViewIsModal`: Result on its full-screen View (its test asserts it), Pause and the dialogs through `DialogCard`; `check-screens.mjs` reports `overlay-not-modal` otherwise. That keeps screen tests fast and independent of the stores. Skia is mocked centrally by the unit project's `jest.setup.ts`, so a view that renders `LogoTile`, `EmptyStatsPicture` or `HazardStrip` needs no mock of its own (component-contract.md).

Every press already sounds: the press hosts (`RaisedSurface`, `QuietButton`, `ListRow`) run the Shell's tap feedback, and a switch's handler plays the toggle feedback instead. A screen never plays a UI sound itself.

**Motion in parity captures.** Every animation reads `useReduceMotion()` (the model passes it down as `isReducedMotion`). The same hook is true during a parity capture (a test build launched with `animations=off`), so the looping flag of the current level, the S1 and S12 busy blocks, sticker slaps, star pops, confetti, entrances and screen transitions all hold still at rest and the frame settles. A loop that ignores `useReduceMotion()` is a bug. The Settings "Reduce motion" row reads the saved choice (`useReduceMotionSetting()` from `app/use-reduce-motion-setting.ts`), never the freeze, and so does code the test-only entry reaches (the S15 debug model), where importing `use-reduce-motion.ts` would close an import loop through `app/test-only.ts`.

**Frame-state openers.** A design frame that shows a state (a dialog, a pressed key, a second page) is opened by the model hook that owns the state, once on mount, through the same handler a player's tap uses; the parity harness only says which state (`TEST_ONLY?.parityFrameState()`). A state the first render can hold is the `useState` initializer (Levels' tapped locked tile, How to play's step 2); a state reached through another provider or a service runs once from an effect (`app/use-parity-opener.ts`: the state read once, the handler through `useEffectEvent`). The openers: S4 `use-home-model` (progress restored), S8 `use-levels-model` (locked tile tapped), S11 `use-settings-extras` (reset dialog held at 46 %), S11a `use-settings-language-model` (restart dialog), S12 `use-premium-model` (Buy pressed once on the purchase cards, the four restore toasts), S13 `use-how-to-play-model` (step 2); the Game frames (pause open, result win and lose) belong to game-host-integration's session-controls hook, and S3's consent moment to admob-ads. Each opener has a test with a parity session, and a normal launch never opens anything.

## A partial Shell (shell-slice.json)

A repo may build only some screens (a parity slice, a game-first repo). It says so in `shell-slice.json` at the repo root, for example `{ "screens": ["S4", "S11", "S12"], "why": "Home + Settings parity slice" }` (ids S1-S15 and S11a-S11d; `[]` means no Shell app). Screens outside the slice have no route or view files: only the slice's screens are copied, each with its model hook, view and tests; the navigator keeps every route and points the others at `NotBuiltScreen` (navigation-and-routing), so the model hooks navigate normally.

Every Shell app still has the **Shell core**, whatever the slice, because the composition root and the startup import it (without it a slice of S1, S4, S8 and S11 left 34 modules unresolved). This skill's part of the core, copied with the first screen:

| Core file (this skill) | Screen it belongs to | Why every Shell app needs it |
|---|---|---|
| `screens/dialogs/dialog-host.tsx`, `dialog-request.ts`, the six dialogs and `dialog-frame.tsx`; `app/dialog-context.tsx` | S14 | the composition root's `shell-navigator.tsx` wraps the navigator in `DialogProvider` |
| `game-host/game-top-bar.tsx` (+ test) | S5 | game-host-integration's `top-bar-model.ts` imports its props types |
| `screens/game/game-layout.tsx` (+ test) | S5 | `game-top-bar.test.tsx` renders the top bar inside it |
| `screens/result/result-model.ts` | S7 | game-host-integration's `resultModelOf` returns it |
| `screens/debug/debug-rows.ts` | S15 | e2e-maestro's `debug-actions.ts` (the debug kit every test build has) imports its action types |

The rest of the core belongs to other skills: the Tutorial route's screen (game-host-integration's `screens/first-run/tutorial-*`, always routed to `TutorialScreen`), the e2e debug kit without `use-debug-model` and the S15 view (e2e-maestro), the parity harness (toybox-visual-parity) and `app/perf/` (performance-budgets). While S15 is outside the slice the test-only pair leaves out `DebugScreen` and `FontTestScreen`, and the Debug and FontTest routes point at `NotBuiltScreen`. `check-screens.mjs .` prints `SKIP <folder> [screen] <S-id> not in shell-slice.json` for every screen outside the slice (not a problem) and checks the slice's screens strictly: each must be built (`screen-not-built` otherwise), and `--all` means every slice screen. Add a screen's id in the commit that builds it; a slice never ships (navigation-and-routing's `--complete` and the release checks fail while the file exists).

## Right to left

Layout mirrors in fa/ckb because rows use `flexDirection: 'row'` and start/end styles; nothing else is needed. Hard shadows point down in both directions. Only the `back`, `chevron`, `forward` and `undo` icons mirror; play, pause, clocks, stars, logos, pictures and the lock never do. Things that fill from the start edge run right to left (slider, progress bar, hold fill, the toggle knob's "on" end, the week strip and the bar chart, Monday on the right). Start/end items follow: the hero cap (start), the level flag (top-end corner, so top-left in RTL), the group tab (14 from the start), dialog buttons (safe choice at the start, so on the right). Sticker tilt does not mirror. Game names stay LTR (isolated) in Lilita One; every other role uses Vazirmatn with the Arabic line heights; digits are Persian (۰–۹) unless the Numbers setting says Latin. See `assets/reference/s4-home-light-fa.png`.

## Dark theme

The ground becomes the game's night colour, surfaces one step lighter; text is moonlight and outlines a pale chalk line of the game's hue; shadows go near-black (depth then reads from outline and offset); accent and pop brighten and text on them turns dark. Printed parts do not change: stickers keep gold, accent or pop paper with toy-ink edges and text, the white die-cut ring stays white. The toast inverts to a pale chip. All of it comes from the theme; a screen never checks the scheme except to pick `SHELL_COLORS[theme.scheme]`. See `assets/reference/s4-home-dark-en.png`.

## Large text (200 %) and small or wide windows

Text wraps, never truncates. When `useWindowClass().isLargeText`: the Home keys, two-button rows, the streak panels and 3-column stat grids stack vertically (`usePairLayout` does it); row values drop under their labels; level tiles grow in height (the grid stays 6 columns on phones); the hero key grows taller (min 80). The body scrolls instead of clipping.

## Accessibility

Buttons have role `button` and a label (icon-only buttons too); toggle rows and pause keys are `switch` with `checked`; segments and language options are `radio` with `selected` inside a `radiogroup`; group tabs, top-bar titles and panel headings are headers; stars, week marks, chart columns and the splash loader are labelled images with their deck keys; toasts are alerts (announced). Locked level tiles carry the locked label and hint.

## Reference images

`assets/reference/<frame>.png` holds every design frame of the map at 1x (1 pt = 1 px), light theme, English, Line Siege paint, at the parity device size: the iPhone 16 Pro, 402 x 874 pt with a 62 pt status bar (the mockup's 390 x 844 phone re-laid out at that size). Tall frames (S10, S11, S11c, S11d, S15) show the full scroll height; the S12 state cards are fragments, not phones. `s4-home-dark-en.png` and `s4-home-light-fa.png` show the dark theme and right to left. The images are the toybox-visual-parity reference set (rendered at 3x from the Toybox mockup with its fonts: Lilita One, Rubik, Vazirmatn) scaled to a third, so what a builder looks at here is exactly what the parity comparison measures against. Open the frame before building a screen and again when it is done; toybox-visual-parity holds the other themes and languages at full resolution and runs the comparison.

The copies here were made before the round-3 design changes (Persian level numbers at line height 1.45, the S11 version line without its 6 pt gap, the S13 step 4 text, and the no-music and score-line variants); the English light frames they show are unchanged except the S11 footer's spacing. The measured comparison always uses toybox-visual-parity's current references and variants.

How to refresh them after a design change: let toybox-visual-parity render its reference set again, then scale each `light-en` frame (and the two Home extras) to a third of its width with the macOS tool `sips --resampleWidth <width / 3> <in.png> --out <out.png>`. Without that skill, the same pictures come from the mockup in headless Chrome (Playwright): device scale factor 1, `localStorage` `pa-toybox.theme = light`, `.lang = en`, `.game = lineSiege`, the three font families served from local TTF files, `--pz: 1` and `--mz: 1`, the phone bezel removed (`.phone` padding, radius and shadow), `.scr` set to 402 x 874 and `.sb` to 62, each frame pinned at (0, 0) and shot with a clipped screenshot, animations disabled. Frame selectors and names are the map's `frameSelectors` and `frameKeys`. `list-screen.mjs --all` fails when a frame has no image.

## Values the design leaves open (Chosen)

Each screen reference marks its Chosen states. Across screens: the top bar stays fixed and only the body scrolls; the banner collapses with its slot (Home and Statistics pin it under the scroll; Levels draws it as the scrolling body's last item, as its design does); a toast leaves after about 3 s (Levels places its toast where the design draws it, 352 pt below the body's top; S12's restore toast sits 14 pt above the bottom of the body); the hold fill animates linearly over 2 s; confetti falls with the success sticker and hides under Reduce motion; the "Phone language" sticker marks the phone's language. Open question for the owner: which element on Home opens S9 (the design's daily panel has only its play button).
