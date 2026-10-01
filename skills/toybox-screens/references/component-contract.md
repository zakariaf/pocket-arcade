# The component contract the screen templates use

The screen templates are built from the Shell's Toybox components in `packages/shell/src/ui/`: toybox-components builds them, toybox-design-system provides `AppText`, `RaisedSurface`, the theme and tokens, code-drawn-art-and-icons provides `Icon`, `LogoTile`, `EmptyStatsPicture` and `HazardStrip`, react-components-and-hooks provides `ScreenFrame`, and the ads work provides `AdBannerSlot`. This page lists every component and prop the templates call, the testID parts each one derives, and the facts a screen must know, so a screen can be built and checked the same way every time. The templates were type-checked, linted and tested against these exact components.

If the app's components ever differ, keep the screen's testIDs, order, copy keys, variants and spacing exactly as the template has them and adapt only the call. Never drop a testID part a component is supposed to draw: `check-screens.mjs` reads the id props from the JSX and then reports the part missing.

## Contents

- Frame and layout
- Text, icons and art
- Buttons and keys
- Rows, lists and controls
- Panels, stickers and tiles
- Data displays
- Overlays, toasts and ads
- Rules every screen follows with these components
- Gaps between the design and the components (known)

## Frame and layout

| Component (file) | Props the templates use | Derives | Notes |
|---|---|---|---|
| `ScreenFrame` (`ui/screen-frame.tsx`) | `testID` (`<scope>.screen`), `children` | | the ground, safe areas, 640 pt max column; no padding of its own |
| `ScreenBody` (`ui/screen-body.tsx`, **this skill's template**) | `children`, `gap?: 'default' \| 'settings' \| 'long' \| 'stats'`, `testID?`, `isUnderHomeIndicator?` (the body runs under the home indicator: bottom padding `max(34, inset)`), `isAboveBanner?` (a banner slot follows: bottom padding = the body's gap, as the design's band is the body's last flex item), `hasTopOverhang?` (10 pt more clip room above a tilted first sticker), `scrollToY?` | | a ScrollView body: padding 6 / 20 / 34 (with the inset), gap 14 / 20 / 18 / 16 |
| `usePairLayout(gap)` (`ui/use-pair-layout.ts`, **this skill's template**) | returns `{ row, item }` styles | | side-by-side blocks (keys, streak panels) that stack at 200 % text; buttons use `isInRow` instead |
| `TopBar` (`ui/top-bar.tsx`) | `testID`, `isReducedMotion`, `title?`, `onBack?`, `backLabel?` (`t('common.back')`), `start?` (Home's brand lock), `end?` (one action or sticker) | `.back-button` `.title` | min 66, padding 4 / 16 / 8, gap 12, back key 48 |
| `BrandLock` (`ui/brand-lock.tsx`) | `testID` (`home.brand-lock`), `nameTestID` (`home.game-name`), `gameName`, `logo` (a `LogoTile`), `badge?` (the Premium sticker) | | logo to name 12, name to badge 6 |
| `GameTopBar` (`ui/game-top-bar.tsx`) | `testIDBase` (`game`), `pauseLabel`, `onPause`, `modeText`, `progressText`, `scoreText`, `undo?` / `hint?` (`{ label, onPress, isDisabled? }`), `isReducedMotion` | `.top-bar` `.pause-button` `.mode-label` `.progress-label` `.score` `.undo-button` `.hint-button` | padding 4 / 14 / 8, gap 10; a missing tool is left out, never greyed. The Game screen uses it through this skill's `game-host/game-top-bar.tsx` (same name), which takes the game host's `GameTopBarProps` (`undo` / `hint` as `GameTool \| null` with `isAvailable`) |

## Text, icons and art

| Component | Props | Notes |
|---|---|---|
| `AppText` (`ui/app-text.tsx`) | `text` (from `t()`, a formatter or an autonym), `variant` (a type role or component style), `tone` (`default`, `muted`, `onPrimary`, `onPop`, `danger`, `success`, `toyInk`, `onInk`, `toast`), `align` (`start`, `center`, `end`), `language` (autonyms), `numberOfLines`, `isHeader`, `testID` | the only text component; caps Dynamic Type at 200 % |
| `Icon` (`ui/icons/icon.tsx`) | `name`, `color`, `size?`, `testID?` | decorative; `back`, `chevron`, `forward`, `undo` flip in RTL. Accepts a `testID` for the map's icon ids (`daily.streak-rule.icon`, `stats.local-note.icon`, `settings.autosave-note.icon`) |
| `LogoTile` (`ui/logo-tile.tsx`) | `logo` (the game's `LogoArt`), `variant` (`splash` 152, `home` 46, `statsHeader` 36, `about` 92 cut, `lose` 104), `testID?` | a Skia canvas in the accent tile, never mirrored, hidden from VoiceOver. Every model that shows it carries `logo` |
| `ArtTile` (`ui/art-tile.tsx`) | `icon`, `paint?` (`pop`, `gold`, `danger`), `size?` (`regular` 64, `dialog` 56, `summary` 52), `testID?` | tilted, ringed, hidden from VoiceOver |
| `PremiumArt` (`ui/premium-art.tsx`) | `testID?` | 108, gold, crown, tilt -6 |
| `EmptyStatsPicture` (`ui/empty-stats-picture.tsx`) | `width?`, `testID?` | the boxed star (190 × 150), Skia |
| `HazardStrip` (`ui/hazard-strip.tsx`) | `testID?` (`debug.hazard-strip`) | the S15 stripes, Skia |

Skia's native module does not load in Jest's `unit` project. The unit project's `jest.setup.ts` (unit-and-component-tests) mocks `@shopify/react-native-skia` for every suite, so a view test that renders `LogoTile`, `EmptyStatsPicture` or `HazardStrip` needs only a tiny `LogoArt` (`{ layers: [{ role: 'p', d: 'M22 2.5H26V17.5H22Z' }] }`), as the templates' tests do. Never add a partial local Skia mock: it replaces the central one, and the icon rasteriser (`Skia.Paint()` at load) then crashes the suite with "Cannot read properties of undefined (reading 'Paint')". A suite that crashes with "Native Skia Module failed to correctly install JSI Bindings" means the repo's `jest.setup.ts` lacks the central mock: restore it from unit-and-component-tests.

Decorative parts (`LogoTile`, `ArtTile`, `IconTile`, `CalendarTile`, `PremiumArt`, `PagerDots`, `RadioMark`, the `Toggle` graphic, `Confetti`, `HazardStrip`, `EmptyStatsPicture`, unlabelled stars and marks) hide themselves from VoiceOver. Maestro therefore never lists them, and the shared map marks them crop-only (`a11yHidden`, or `parent` inside an accessible element): the parity gates compare their pixels inside the crop of `coveredBy` instead of measuring their bounds. The press hosts (`RaisedSurface`, `QuietButton`, `ListRow`) play the Shell's tap feedback on every press except a switch, whose handler plays the toggle feedback.

## Buttons and keys

| Component | Props | Derives | Notes |
|---|---|---|---|
| `Button` (`ui/button.tsx`) | `testID`, `label`, `onPress`, `isReducedMotion`, `kind?` (`primary`, `secondary` default, `pop`, `danger`, `quiet`), `size?` (`regular`, `hero`), `cap?` (hero start square), `icon?`, `iconEnd?`, `isBlock?`, `isInRow?`, `isDisabled?`, `isBusy?`, `hint?` | | regular min 54, hero min 80 (always a block). `isInRow`: grows from a 120 pt basis in a wrapping row (dialog rows, Replay / Levels, Previous / Next). One `size="hero"` per screen |
| `QuietButton` (`ui/quiet-button.tsx`) | `testID`, `label`, `onPress`, `isReducedMotion`, `icon?`, `iconEnd?`, `isDisabled?`, `hint?` | | the underlined nudge (`Button kind="quiet"` renders it too) |
| `HoldButton` (`ui/hold-button.tsx`) | `testID`, `label`, `hint`, `onConfirm`, `isReducedMotion`, `icon?`, `frozenProgress?` | `.fill` | the S14 reset key: owns the 2 s hold (`ReduceMotion.Never`) and the VoiceOver `activate` action; a short tap does nothing; `frozenProgress` (0..1, test builds' parity frame only: 0.46) holds the fill still and a press neither fills nor confirms |
| `KeyButton` (`ui/key-button.tsx`) | `testID`, `icon`, `label`, `onPress`, `isReducedMotion` | | the Home keys, 94 tall |
| `RowButton` (`ui/row-button.tsx`) | `testID`, `icon`, `label`, `onPress`, `isReducedMotion`, `description?`, `iconPaint?`, `kind?` (`secondary`, `pop`), `hint?` | `.icon` `.label` `.description` | min 68 |
| `IconButton` (`ui/icon-button.tsx`) | `testID`, `icon`, `label`, `onPress`, `isReducedMotion`, `size?` (`regular` 48, `small` 44), `isDisabled?`, `hint?` | | |
| `ToggleKey` (`ui/toggle-key.tsx`) | `testID`, `icon`, `label`, `stateLabel`, `isOn`, `onToggle`, `isReducedMotion` | `.icon` `.label` `.state` | the Pause keys; a switch |
| `OptionCard` (`ui/option-card.tsx`) | `testID`, `label`, `isSelected`, `onSelect`, `isReducedMotion`, `language?`, `badge?` | `.label` `.radio` | S2 languages; a radio |
| `LevelTile` (`ui/level-tile.tsx`) | `testID` (`levels.level-tile.<n>`), `numberText`, `state` (`{ kind: 'completed', stars: 1\|2\|3 }`, `{ kind: 'current' }`, `{ kind: 'locked' }`), `label`, `hint?` (locked), `onPress`, `width` (S8's `tileWidthFor(width, scale)`, on the pixel grid), `isFocused?`, `isReducedMotion` | `.number` `.stars-<k>` `.flag` | 62 tall; locked tiles stay tappable (the screen shows the unlock toast); the number is the `levelNumber` role (21 display; line height 1.0 in Latin, 1.45 in Persian and Kurdish so iOS never clips the digits) |

## Rows, lists and controls

| Component | Props | Derives | Notes |
|---|---|---|---|
| `ListGroup` (`ui/list-group.tsx`) | `testID`, `title`, `icon`, `children` | `.tab` `.list` | always a folder tab over a list (S11 groups, S11d groups) |
| `List` (`ui/list.tsx`) | `testID`, `children` | | a list without a tab: `premium.benefits-list`, `about.facts-list`, `about.links-list`, `settings-language.list`, `debug.list` (the map calls them ListGroup) |
| `ListRow` (`ui/list-row.tsx`) | `testID`, `label`, `isReducedMotion`, `end?` (`chevron`, `toggle`, `radio`, `none`), `onPress?`, `isOn?` (toggle), `isSelected?` (radio), `icon?` (`IconTileIcon`: an icon name, `rating-star` or `rating-star-hollow`), `iconPaint?`, `description?`, `descriptionTestID?` (S11d's `.licence`), `textExtra?` (more lines in the text column, each at its own width: S11d's column row), `value?`, `isDanger?`, `isStrong?` (a bold label in ink, S11 "Remove ads"), `isFirst?`, `below?` (a full-width line under the label), `labelLanguage?`, `hint?` | `.icon` `.label` `.description` `.value` `.toggle` `.radio` | min 60; the whole row is the target and its role follows `end` (button, switch, radio) when it has `onPress`; a toggle row flips in `onPress` |
| `SubRow` (`ui/sub-row.tsx`) | `testID`, `label`, `children` | `.label` | the S11 volume row (start padding 64) around a `Slider` |
| `SegmentedControl` (`ui/segmented-control.tsx`) | `testID` (the radiogroup), `segmentTestIDBase`, `label`, `segments` (`{ value, label, preview?, previewLanguage? }[]`), `selected`, `onSelect`, `isReducedMotion`, `isInRow?` | `<segmentTestIDBase>.<value>` with `.label` `.preview` | chosen = accent, pushed in, check |
| `Slider` (`ui/slider.tsx`) | `testID`, `label`, `value` (**0–1**), `onChange` (0–1, called on every drag step and tap), `isOff?` | `.fill` | adjustable, 10 % steps for VoiceOver. The save keeps integer percent: the S11 volume row passes `volume / 100` and dispatches `Math.round(ratio * 100)` only when the percent changes |
| `ProgressBar` (`ui/progress-bar.tsx`) | `testID`, `label`, `value` (0–1) | | no layout prop: wrap it in a `View` to size it |

## Panels, stickers and tiles

| Component | Props | Derives | Notes |
|---|---|---|---|
| `Panel` (`ui/panel.tsx`) | `testID`, `children`, `tone?` (`default`, `locked`, `error`), `padding?` (`regular` 14 × 16, `compact` 12 × 14, `daily` 14 / 14 / 16), `isRow?`, `gap?` (default 12) | | flat, no shadow. Streak cards: `padding="compact" gap={4}`; the locked pack: `tone="locked"`; row panels: `isRow` |
| `PanelHeader` (`ui/panel-header.tsx`) | `testID` (`<panel>.title`), `title`, `leading?` (IconTile `size="statHeader"` or LogoTile `statsHeader`) | | 12 pt under it; S10 panels use `gap={0}` |
| `NotePanel` (`ui/note-panel.tsx`) | `testID`, `icon`, `text`, `isError?`, `isStrong?`, `iconTile?` (an `IconTilePaint`: the icon in a centred 38 pt tile, S11a's pop globe) | `.icon` `.label` | a panel laid out as a row with a 22 pt icon (top-aligned, as `.note-p`), or the tile |
| `OfferBox` (`ui/offer-box.tsx`) | `testID`, `children` | | the S7 dashed continue frame |
| `Sticker` (`ui/sticker.tsx`) | `testID` (on its text), `text`, `paper?` (`gold` default, `accent`, `pop`, `ink`), `size?` (`regular`, `sm`, `xs`), `tiltDeg?` (2 to 8 either way, default -4), `icon?` (an icon or `rating-star`), `slapDelayMs?`, `isReducedMotion?` | | the win title slaps at 700 ms, Premium active at 0 |
| `Chip` (`ui/chip.tsx`) | `testID`, `text` | | aligns itself to the start (`alignSelf: 'flex-start'`): to centre one, put it in a `{ flexDirection: 'row', justifyContent: 'center' }` wrapper (the same for Sticker); a wrapper's `alignItems` does not move it |
| `IconTile` (`ui/icon-tile.tsx`) | `icon` (or `rating-star`, `rating-star-hollow`), `paint?` (`pop`, `accent`, `gold`, `danger`, `plain`), `size?` (`row` 38, `statHeader` 34), `testID?` | | hidden from VoiceOver |
| `RatingStar` (`ui/rating-star.tsx`) | `isFilled`, `size` (pt), `hollowColor?` | | no `testID`: wrap it in a `View` that carries the map id (`daily.best-streak-card.icon`, `levels.pack.<n>.progress-star`) |

## Data displays

| Component | Props | Derives |
|---|---|---|
| `CalendarTile` (`ui/calendar-tile.tsx`) | `testID` (`daily.today-card.calendar`), `monthText`, `dayText` | `.month` `.day` (hidden from VoiceOver: the date is also written out) |
| `WeekStrip` (`ui/week-strip.tsx`) | `testID` (`daily.week-strip`), `dayTestIDBase` (`daily.week-day`), `days` (`{ letter, state: 'done'\|'missed'\|'today', isToday, label }[]`, oldest first), `todayTagText` | `<base>.1`…`.7` (position: 7 = today) with `.letter` `.mark` `.today-tag` |
| `WeekLegend` (`ui/week-legend.tsx`) | `testID` (`daily.week-card.legend`), `doneText`, `missedText` | `.done` `.missed` (brings its own 14 pt top margin) |
| `StatGrid` (`ui/stat-grid.tsx`) | `testIDBase` (the panel id), `cells` (`{ id, value, label }[]`), `columns?` (2, 3) | `<base>.<id>` with `.value` `.label` |
| `StatList` (`ui/stat-list.tsx`) | `testIDBase` (the panel id), `rows` (`{ id, label, value }[]`), `heading?` (`{ testID, text }`) | `<base>.list`, `<base>.<id>` with `.label` `.value` |
| `WeekBars` (`ui/week-bars.tsx`) | `testID` (`stats.week-card.chart`), `barTestIDBase` (`stats.week-bar`), `bars` (`{ value, valueText, day, label }[]`, oldest first) | `<base>.1`…`.7` (labelled images) with `.value` `.bar` `.day` |
| `ScorePanel` (`ui/score-panel.tsx`) | `testIDBase` (`result.score-card`), `label`, `value`, `newBestText?`, `progressLine`, `line?` (`{ kind: 'moves' \| 'score', text }`: the win's moves or score line; daily and endless have none), `isReducedMotion` | `.label` `.value` `.new-best` `.progress-line`, and `.moves-line` or `.score-line` by the line's kind (the base itself is the panel) |
| `ResultStars` (`ui/result-stars.tsx`) | `testID` (`result.stars-<count>`), `count`, `label`, `isReducedMotion` | one labelled image; pops in, all at once under Reduce motion |
| `HowToStage` (`ui/how-to-stage.tsx`) | `testID` (`how-to-play.stage`), `children` (the game's picture, wrapped in the labelled `how-to-play.picture` image) | |
| `PagerDots` (`ui/pager-dots.tsx`) | `testID` (`how-to-play.pager-dots`), `count`, `index` (0-based) | `.1`…`.n` (decorative, hidden from VoiceOver) |
| `EmptyState` (`ui/empty-state.tsx`) | `testIDBase` (`stats.empty-state`), `picture`, `title`, `body`, `action` (the hero key), `footer?` | the base, `.picture` `.title` `.body` |

## Overlays, toasts and ads

| Component | Props | Notes |
|---|---|---|
| `Scrim` (`ui/scrim.tsx`) | `testID` (`<dialog>.scrim`, `pause.scrim`), `children` | covers the screen and centres the card 28 pt from top and bottom, 20 from the sides; the screen adds no overlay View |
| `DialogCard` (`ui/dialog-card.tsx`) | `testIDBase` (the dialog scope), `cardTestID?` (Pause: `pause.dialog`), `title?`, `body?`, `art?` (an `ArtTile` with `<scope>.art`), `variant?` (`regular`, `pause`), `children` (the buttons) | derives `.card` `.title` `.body`; modal for VoiceOver; static hard shadow 8 |
| `DialogButtonRow` (`ui/dialog-button-row.tsx`) | `testID` (`<scope>.buttons`), `children` (`isInRow` buttons, safe choice first) | wraps at 200 % text. Every two-button dialog row has its `<scope>.buttons` id (the Chosen restart-level and newer-save rows are listed in the map's `notDrawn`) |
| `Toast` (`ui/toast.tsx`) | `testID`, `text`, `icon` (an icon or `'busy'`), `isReducedMotion`, `delayMs?` | an alert; also announce it |
| `BusyBlocks` (`ui/busy-blocks.tsx`) | `size` (`button`, `splash`), `color`, `isReducedMotion`, `label?` (splash only), `testID?` | the S1 loader is `size="splash"` in `theme.colors.icon` with the `splash.loading.a11y-label` label |
| `Confetti` (`ui/confetti.tsx`) | `testID`, `isReducedMotion` (frozen motion: the first still frame), `isHiddenBySetting?` (the player's saved Reduce motion setting: nothing drawn) | the pieces scatter left to right in every language (the band is `direction: 'ltr'`) |
| `AdBannerSlot` (`ui/ad-banner-slot.tsx`, admob-ads) | `testID` (`<screen>.banner-ad`), `renderBanner`, `isAllowed` | zero height until an ad loads; only Home, Levels, Statistics |

## Rules every screen follows with these components

- `isReducedMotion` comes from `useReduceMotion()` in the model hook (never Reanimated's `useReducedMotion()`, which ignores the Shell setting). Every raised control and every animated part takes it.
- Pass the base props exactly as the map spells them (`testIDBase="result.score-card"`, `segmentTestIDBase="settings.numbers-segment"`, `dayTestIDBase="daily.week-day"`, `barTestIDBase="stats.week-bar"`): the component builds every child id from them, and `check-screens.mjs` reports each child missing when a base is misspelled.
- Keyed children are keyed by data (`StatGrid` cell `id`, `SegmentedControl` segment `value`, `StatList` row `id`), never by position; only the week strip and week bars count by position, and the component does it.
- Decorative parts are hidden by the components. View tests that list every design testID query them with `{ includeHiddenElements: true }`; role queries cover what VoiceOver must reach.

## Gaps between the design and the components (known)

Reported to the owner; the templates use the closest component call and keep every testID.

Closed gaps (the components now have the option, and the templates use it): "Remove ads" passes `isStrong`; "Rate this game" passes `icon: 'rating-star-hollow'`, the design's `star(false)` (the hollow rating star with its 1.8 edge; the 2.5-stroke `star-outline` icon is visibly heavier, and check-screens fails it as `rate-row-icon`); S11d's licence line is the row's description (`descriptionTestID="<row>.licence"`) and the column row's second line and nudge are its `textExtra`; the S11a note passes `iconTile="pop"`.
- **`BannerBand` is not used around the ad.** Only `AdBannerSlot` knows when the ad has loaded, and the native banner must stay mounted to load; the screens render `AdBannerSlot` directly and give it the band's look as `loadedStyle={useBannerBandStyle()}` (`ui/use-banner-band-style.ts`), so the band appears only with a loaded ad.
