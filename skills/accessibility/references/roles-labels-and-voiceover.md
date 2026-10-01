# Roles, labels, targets and VoiceOver

What every interactive element must expose, how the Toybox components map to accessibility roles, how the board is spoken, and how overlays and other languages behave.

## Contents

- The pressable checklist
- Roles and states per component (Toybox)
- Names, hints and translations
- Touch targets
- Grouping, sliders and hold actions
- Card that opens a screen plus its own key
- The board for VoiceOver
- Announcements
- Order, overlays and languages

## The pressable checklist

Screens use the Shell's Toybox `ui/` components (`Button`, `IconButton`, `LevelTile`, `ListRow`, keys); only `packages/shell/src/ui/**` imports `Pressable`. Every `Pressable` there has:

| Prop | Value |
|---|---|
| `accessibilityRole` | `button` (or `switch`, `tab`, `link`, `radio`, `adjustable` where true) |
| `accessibilityLabel` | the translated visible text, or the required `label` prop for icon-only buttons; a row whose own children render its texts (label, value, description) may leave it out, and VoiceOver reads those texts in order |
| `accessibilityHint` | only when the result is not obvious from the label, translated |
| `accessibilityState` | `{ disabled, busy }`, plus `selected` / `checked` for toggles, tabs, segments and options; also set `disabled` on the `Pressable` |
| size | its own box at least 44 × 44 pt (`MIN_TOUCH`), never `hitSlop` |
| `testID` | `<screen>.<element>` in kebab-case |
| feedback | `style={(state) => [styles.base, state.pressed && styles.pressed]}` |

Why: VoiceOver reads role, name and state; RNTL's `getByRole('button', { name })`, `toBeDisabled()` and `toBeBusy()` assert them.

## Roles and states per component (Toybox)

| Element | Role | Name | State / value |
|---|---|---|---|
| Buttons, hero key, icon buttons, row buttons, home keys | `button` | translated label | `disabled`, `busy` |
| Level tile | `button` | "Level 12: 2 stars" / "Level 41, locked" (`levels.level-tile.a11y-label`, `.locked.a11y-label`) | hint on locked tiles: "Shows how to unlock this level." |
| Toggle rows (the whole 60 pt row is the target), pause keys | `switch` | row label | `checked`; the knob shows a check or a dash as well |
| Segments, language options (S2, S11a) | `radio` | option name | `selected` |
| Volume row / slider | `adjustable` | row label | `accessibilityValue {min: 0, max: 100, now}` + increment/decrement actions |
| Pack tabs | `tab` | pack name | `selected` |
| Group tabs, top-bar titles, panel headings, section titles | `header` (`AppText isHeader`) | the title | — |
| Board | `image` | `t()` of `board.describe(view)` | updated with every view |
| Pause, dialogs, sheets | the overlay root with `accessibilityViewIsModal` (for every Toybox dialog, the `Scrim`) | the title | — |
| Stars, week marks, chart columns, splash loader | labelled with their deck keys (`result.win.stars.a11y-label`, `daily.week.day-*.a11y-label`, `stats.week.bar.a11y-label`, `splash.loading.a11y-label`) | — | — |
| Decorative art, logos, pager dots, the calendar tile | hidden (`accessible={false}` / `importantForAccessibility="no"` on the art) | — | — |

## Names, hints and translations

- Every name and hint comes from `t()` with a catalog key (usually ending in `.a11y-label` / `.a11y-hint`), in all four languages. A literal `accessibilityLabel="Play"` is English for everyone.
- Presentational components receive the translated string as a prop (`label`, `hint`); the screen's model hook calls `t()`.
- Counted values use plurals in the message (`Level {level, number}: {starsCount, plural, =0 {no stars yet} one {# star} other {# stars}}`), never string building.
- A button's name is its visible text; an icon-only button takes a required `label`.

## Touch targets

- Every Shell touch target's own box is at least **44 × 44 pt** (`MIN_TOUCH`): `minWidth`/`minHeight` or `width`/`height` on the `Pressable` itself. Do not use `hitSlop` to reach 44: it is invisible in layout and overlaps neighbours.
- Toybox sizes: keys 48–94 pt tall, icon buttons 48 pt (44 in the game top bar), rows 60 pt, the hero key 80 pt (grows with large text), level tiles about 51.7 × 62 pt, quiet buttons 44 pt.
- Level tiles are 6 equal columns (about 51.7 pt wide on a 390 pt phone, never below 44 pt) and 62 pt tall; at large text they grow taller with the font (`minHeight`, not a fixed `height`), the grid stays 6 columns on phones.
- Boards expose their smallest hit region (cell size + 2 × the hit slop of the board's own gesture code); each game has a Jest test asserting it is at least 44 pt at 402 × 874 pt. An exception needs the owner's sign-off in the game's design pass.

## Grouping, sliders and hold actions

- **Settings rows are one accessible element**: label, value and control read together, one swipe per row.
- **Custom sliders** use `accessibilityRole="adjustable"`, `accessibilityValue={{ min, max, now }}`, declare `accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}` and handle both in `onAccessibilityAction` (step 10, clamped to 0–100), so volume works with VoiceOver's one-finger swipe up/down. Without the declared actions the swipe does nothing.
- **Hold and long-press actions** get a screen-reader alternative: `accessibilityActions` (for example `{ name: 'activate' }`) with `onAccessibilityAction`, or a confirmation dialog. "Reset all progress" (hold 2 s) must be confirmable without holding. The hold timer itself passes `reduceMotion: ReduceMotion.Never` (a safety timer, not decoration).

## Card that opens a screen plus its own key

Home's daily card is the pattern: tapping the card body opens S9 Daily challenge, and its Play key starts today's run. A key inside another accessible element is unreachable (iOS reads the outer element as one and never lets VoiceOver into it), so the two are **sibling accessible elements, never nested**:

1. The card is a plain `View` with the panel look (edge, fill, padding); it is not accessible itself.
2. Its bottom layer is an absolutely filled `Pressable` (`StyleSheet.absoluteFill`, the first child): the card opener. It has `accessibilityRole="button"`, the screen map's testID (`home.daily-card`), and an `accessibilityLabel` that joins the card's visible texts in reading order (title, date, streak), built in the model hook from the same translated strings the card shows, so VoiceOver says what a sighted player reads.
3. The visible title, date, streak and icon sit above that layer in a `View` hidden from VoiceOver (`accessibilityElementsHidden` and `importantForAccessibility="no-hide-descendants"`): they are already in the opener's label. The parity screen map makes them crop-only parts covered by the opener (`coveredBy: home.daily-card`).
4. The key (`home.daily-card.play-button`) is a separate accessible element placed above the opener, never inside it. Taps on the key reach the key; taps anywhere else on the card reach the opener.
5. When the card's state replaces the key (today's run is done: the done row), the opener still opens the screen; the done row's text joins the opener's label.

Nothing changes in the pixels. Test it by role and name: `getByRole('button', { name: <the joined texts> })` opens the screen, `getByRole('button', { name: <the key's label> })` starts the run, and the audit line finds no inaccessible pressables. `check-a11y-code` fails `nested-pressable` when an accessible `Pressable` contains another pressable (a raw one, or a component such as `Button` that renders one).

## The board for VoiceOver

Skia content is invisible to the accessibility tree. So each board is **one accessible element**: the board canvas has `accessible`, `accessibilityRole="image"` and `accessibilityLabel` = `t()` of the game's `board.describe(view)` ("Level 12, 3 monsters, your turn"), updated with every new view. It sits inside the LTR board wrapper. Tap-to-play games can later add `accessibilityActions`; v1 asks for a summary "where practical". `accessibilityIgnoresInvertColors` on the board canvas keeps Smart Invert from changing a palette that already has a dark variant.

## Announcements

Results and important events are announced with `useAnnounce()` (`packages/shell/src/app/use-announce.ts`): it calls `AccessibilityInfo.announceForAccessibility` **only while VoiceOver runs** (from `systemA11yStore`), one short announcement per move. Never call `announceForAccessibility` directly.

`systemA11yStore` (a vanilla Zustand store) mirrors the OS switches (`isReduceMotionOn`, `isScreenReaderOn`); `watchSystemA11y(onError)` is called once from the root providers (in a mount effect that returns its unsubscribe function) and is the only place that subscribes to `AccessibilityInfo`.

## Order, overlays and languages

- **VoiceOver order equals visual order.** Do not reorder with absolute positioning over the reading order; in RTL the order starts at the top right.
- **Overlays** (Pause, dialogs, sheets, the S7 result drawn over the board) set `accessibilityViewIsModal` on their root, so VoiceOver cannot wander into the screen or board behind them. For every Toybox dialog the root is the shared `Scrim`, which sets it; a dialog that renders the `Scrim` is modal through it. Never put the flag on the `DialogCard` inside the scrim: a modal child hides its ancestors' identifiers, so the scrim's testID and the screen under it dropped out of the accessibility tree and every S14 capture failed "screen not reached". `check-a11y-code` (`modal-overlay`) follows the component, and toybox-components' `modal-root` rule keeps the flag on the scrim.
- **The two-finger scrub ("Z")** on the Game screen opens Pause instead of leaving the game. The scrub asks the native stack to go back, and the Game screen's `usePreventRemove` (navigation-and-routing) already turns a Back while playing into Pause, and a Back in Pause into Resume. The owner's VoiceOver checklist (step 5) confirms it on the phone; if the scrub does nothing there, add `onAccessibilityEscape` (calling the same pause action) to the Game screen's root view.
- **Text in another language than the UI** (the autonyms in S2 and S11a) sets `accessibilityLanguage` (`AppText language={code}` does it), so Persian is not read with an English voice.
- The first thing read on each screen is its title; nothing is read as just "button".
