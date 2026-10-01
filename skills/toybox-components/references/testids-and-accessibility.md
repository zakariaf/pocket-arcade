# testIDs and accessibility

How every component names itself for Maestro, the visual-parity harness and VoiceOver. The ids here are the ones the design's element map uses, so a screen built from these components lines up with its screenshot checks without renaming.

## Contents

1. [The testID grammar](#the-testid-grammar)
2. [Parts each component derives](#parts-each-component-derives)
3. [Accessibility rules for components](#accessibility-rules-for-components)
4. [One policy for VoiceOver and visual parity (reach)](#one-policy-for-voiceover-and-visual-parity-reach)
5. [Roles by component](#roles-by-component)
6. [Checklist per pressable](#checklist-per-pressable)

## The testID grammar

`<scope>.<element>[.<part-or-key>...]`: every segment `[a-z0-9]+(-[a-z0-9]+)*`, at least two segments.

- **Scope** = the route in kebab-case (`home`, `levels`, `settings-language`), an overlay (`pause`, `result`), a dialog (`<name>-dialog`: `reset-progress-dialog`), `splash` or `consent`. The game screen is `game`.
- **Interactive elements end in their role:** `-button`, `-switch`, `-slider`, `-row`, `-tile`, `-card`, `-segment`.
- **Repeated items append a stable data key, never a list index:** `levels.level-tile.12`, `settings-language.language-row.fa`, `settings.theme-segment.dark`. Days and bars of a week are the one numbered series (`daily.week-day.1..7`, `stats.week-bar.1..7`): the position is the key there.
- **A reusable component takes one testID (or testIDBase) and derives its parts by appending a segment.** The screen never invents part ids.
- `testID` is required on every component a test or the parity harness addresses; purely decorative parts (radio mark, icon tile, art tile) take an optional one because their owner passes `<owner>.icon`, `.radio`, `.art`.

## Parts each component derives

| Component | Prop | Parts (appended to the prop) | Example |
|---|---|---|---|
| RowButton | testID | `.icon` `.label` `.description` | `home.endless-card.label` |
| ToggleKey | testID | `.icon` `.label` `.state` | `pause.sound-switch.state` |
| SegmentedControl | testID + segmentTestIDBase | group = testID; segments `<base>.<value>` with `.label` `.preview` | `settings.numbers-segment.local.preview` |
| Slider | testID | `.fill` | `settings.sound-volume-slider.fill` |
| OptionCard | testID | `.label` `.radio` | `language-choice.language-row.fa.radio` |
| ListGroup | testID | `.tab` `.list` | `settings.group.sound.tab` |
| ListRow | testID | `.icon` `.label` `.description` `.value` `.toggle` `.radio` | `settings.sound-effects-switch.toggle` |
| SubRow | testID | `.label` | `settings.sound-volume-row.label` |
| NotePanel | testID | `.icon` `.label` | `premium.error-note.label` |
| LevelTile | testID | `.number` `.stars-<n>` `.flag` | `levels.level-tile.12.flag` |
| TopBar | testID | `.back-button` `.title` | `levels.top-bar.back-button` |
| GameTopBar | testIDBase | `.top-bar` `.pause-button` `.mode-label` `.progress-label` `.score` `.undo-button` `.hint-button` | `game.hint-button` |
| DialogCard | testIDBase (+ cardTestID) | `.card` `.title` `.body` | `reset-progress-dialog.title` |
| HoldButton | testID | `.fill` | `reset-progress-dialog.confirm-button.fill` |
| CalendarTile | testID | `.month` `.day` | `daily.today-card.calendar.day` |
| WeekStrip | testID + dayTestIDBase | days `<base>.<n>` with `.letter` `.mark` `.today-tag` | `daily.week-day.7.today-tag` |
| WeekLegend | testID | `.done` `.missed` | `daily.week-card.legend.done` |
| StatGrid | testIDBase (the panel) | cells `<base>.<id>` with `.value` `.label` | `stats.overview-card.wins.value` |
| StatList | testIDBase (the panel) | `.list`; rows `<base>.<id>` with `.label` `.value` | `stats.best-card.list` |
| ScorePanel | testIDBase | `.label` `.value` `.new-best` `.progress-line`, then `.moves-line` (`line.kind` `'moves'`) or `.score-line` (`'score'`) | `result.score-card.score-line` |
| WeekBars | testID + barTestIDBase | chart = testID; bars `<base>.<n>` with `.value` `.bar` `.day` | `stats.week-bar.3.bar` |
| PagerDots | testID | dots `.1`..`.n` | `how-to-play.pager-dots.2` |
| EmptyState | testIDBase | `.picture` `.title` `.body` | `stats.empty-state.body` |

The caller passes the rest: `<dialog>.scrim` to Scrim, `<dialog>.art` to ArtTile, `<dialog>.buttons` to DialogButtonRow, `home.brand-lock` and `home.game-name` to BrandLock.

**Maestro sees only accessibility elements.** A part inside an accessible parent (a row's `.label`) is found by RNTL and by an in-app layout reporter, not by Maestro; Maestro reports the nearest ancestor with a role (button, switch, radio, adjustable, image, alert).

**The testID goes on the box the design measures.** When the design measures a whole box (the group tab `.grp-tab`, a chip `.chip`, a sticker `.stk`), the component puts its own testID on that View together with `accessible`, a role (`header` for the tab, `text` for chips and stickers) and the text as `accessibilityLabel`, and the AppText inside has none. On the inner text the id measured only the words: the S11 group tabs went missing from the parity list and a sticker's bounds shrank to its text. `check-components` fails `testid-on-inner-text` when a component's own testID sits on an AppText that is the only labelled child of a View or Animated.View that draws the box (padding, edge or fill) and has no testID. Part ids (`.label`, `.value`, `.title`) stay on their text, and so does text in a plain layout View.

## Accessibility rules for components

1. **Every pressable has a role and a translated name.** Icon-only keys take a required `label`. Rows let VoiceOver read their texts in order instead of a hand-built label.
2. **State goes in `accessibilityState`** (`disabled`, `busy`, `selected`, `checked`) and `disabled` is also set on the pressable, so RNTL's `toBeDisabled`, `toBeBusy`, `toBeChecked` work.
3. **Every pressable box is at least 44 × 44 pt itself.** Never `hitSlop`: it is invisible in layout and overlaps neighbours.
4. **Holds and long presses have a screen-reader alternative.** `HoldButton` exposes the `activate` action; VoiceOver users double-tap.
5. **Decorative parts are hidden** (`accessibilityElementsHidden` + `importantForAccessibility="no-hide-descendants"`): icon tiles, art tiles, Premium art, confetti, calendar tile, pager dots, radio marks, toggle visuals, busy blocks inside a button, rating stars and week marks without a label (the legend), and code-drawn-art-and-icons' logo tile, hazard strip and empty-stats picture. `check-components.mjs` reports `decorative-not-hidden` otherwise.
6. **Charts and marks stand in for text, so they are labelled images:** week marks, week bars, result stars, the splash loader.
7. **Headings pass `isHeader`:** top-bar titles, dialog titles, panel headers, empty-state titles, the stat-list heading. The group tab is the exception: its tab View is the heading (`accessibilityRole="header"`), because the design measures the whole tab.
8. **Text in another language than the UI passes `language`** (autonym rows and option cards), which also sets `accessibilityLanguage`.
9. **Toasts are alerts and are also announced** by the screen (`announceForAccessibility`); a toast is transparent until it lands.
10. **Dialogs are modal** and always offer a way out. The `Scrim` is the modal root (`accessibilityViewIsModal` on the scrim, never on `DialogCard`), so VoiceOver stays inside while the scrim's testID stays in the accessibility tree that Maestro and the parity capture read.
11. **Shape before colour:** every state keeps a non-colour cue (check or dash, dashed edge and padlock, filled vs hollow star, pushed-in depth).
12. **Everything reflows at 200 % text:** labels wrap, dialog rows wrap (120 pt basis), the screen stacks key grids; never truncate.

## One policy for VoiceOver and visual parity (reach)

Maestro's iOS hierarchy is the accessibility tree: it lists accessible elements with their labels, never their children, and omits everything hidden from VoiceOver. The parity gates measure element bounds from it, so the shared screen map classifies every testID:

| Reach | Which elements | Parity |
|---|---|---|
| reachable | the screen root, containers (panels, lists, rows' boxes, top bars), texts and headers outside accessible elements, and accessible elements themselves (buttons, switches, radios, sliders, labelled images, alerts) | `bounds` and any of `text`, `fill`, `crop`; reported `missing` if absent |
| crop-only, `parent` | parts inside an accessible element (a RowButton's icon tile and texts, a ListRow's toggle and radio, a level tile's stars) | `checks: ["crop"]`; judged inside the aligned crop of `coveredBy` (the part's text by ink) |
| crop-only, `a11yHidden` | decorative parts the component hides (rule 5) that are not inside an accessible element (the Home logo, the daily card's icon tile, dialog art, pager dots) | same; a missing or wrong part fails as a `structure` difference of its cover, "inside its crop-only part …" |

So a component keeps its decorative parts hidden (never un-hide one to make it measurable), derives the part testIDs the map lists anyway (tests and E2E flows use them; view tests query hidden parts with `{ includeHiddenElements: true }`), and puts the testID of anything pressable on the accessible element itself.

## Roles by component

| Role | Components |
|---|---|
| button | Button, QuietButton, RowButton, KeyButton, IconButton, LevelTile, HoldButton, ListRow (chevron) |
| switch | ToggleKey, ListRow (toggle) |
| radiogroup / radio | SegmentedControl (group and segments), OptionCard, ListRow (radio) |
| adjustable | Slider |
| progressbar | ProgressBar |
| header | GroupTab, PanelHeader, the titles of TopBar, DialogCard, EmptyState, StatList heading |
| alert | Toast |
| image | WeekMark (strip), WeekBars columns, ResultStars, RatingStars when labelled, BusyBlocks on the splash |
| text | Chip, Sticker |
| none | List, ListGroup, Panel, NotePanel, OfferBox, Scrim, DialogCard, DialogButtonRow, ToastStack, TopBar, BrandLock, GameTopBar, BannerBand, StatGrid, StatList, ScorePanel, HowToStage, EmptyState, SubRow |

## Checklist per pressable

| Prop | Value |
|---|---|
| `accessibilityRole` | `button` (or `switch`, `radio`, `adjustable` where true), written literally on the Pressable |
| `accessibilityLabel` | the translated visible text, or the required `label` for icon-only keys |
| `accessibilityHint` | only when the result is not obvious from the label, translated |
| `accessibilityState` | `{ disabled, busy }`, plus `selected` / `checked` for segments, cards, rows and keys |
| size | own box ≥ 44 × 44 pt |
| `testID` | `<scope>.<element>` in kebab-case, parts derived |
| feedback | sink into the shadow (RaisedSurface); flat rows and quiet buttons tint `sunken`; the host runs `usePressFeedback()` (tap sound) before `onPress`, except a switch (its handler plays the toggle feedback) |

A component test ends with `expect(findInaccessiblePressables(screen.container)).toStrictEqual([])` whenever it renders a pressable.
