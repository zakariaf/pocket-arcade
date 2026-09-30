# S14 Dialogs

S14 dialogs confirm destructive actions and report store and save states, above whatever screen is showing.

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

- Confirm reset progress / statistics / restart level; Premium states (see S12).
- "A new version of the saved data was found" (a save from a NEWER app on an older app): keep it, do not touch it, ask the player to update.
- Damaged save: "Your progress couldn't be loaded. A backup copy was restored." Never a crash.
- All dialogs use start/end button order, which mirrors in RTL (the safe choice at the start).
- Reset all progress is confirmed by holding the button for 2 seconds.

## Layout, top to bottom

The screen underneath stays visible (it keeps its own testIDs), dimmed by the scrim. The overlay (padding 28 x 20) centres the dialog card (3 pt edge, radius 22, surface, padding 22 / 20 / 20, hard shadow 8, gap 12): optional art tile (64; the reset dialog 56 with dangerFill and a danger `trash`) → title (`dialogTitle` 25) → body (17) → buttons.

| Dialog | Art | Buttons |
|---|---|---|
| Reset all progress (over Settings) | 56 pt dangerFill `trash` | danger block hold button with `trash` "Hold to reset" (fills from the start edge for 2 s; the design shows it 46 % held) · caption "Keep holding for 2 seconds." · secondary block Cancel |
| Restart to apply (over S11a) | pop `globe` | row: "Not now" (secondary) · "Restart now" (primary, `restore`) |
| Progress restored (over Home) | gold `restore` | row: OK (primary) |
| Restart level (from Pause; Chosen) | none | row: Cancel (secondary) · Restart (primary, `restore`) |
| Reset statistics (from S10 or S11; Chosen) | as reset progress | danger block "Reset" with `trash` · secondary block Cancel (no hold) |
| Newer save found (Chosen) | gold `restore` | row: Later (secondary) · Update (primary) |
| Crash (`CrashScreen`; Chosen) | pop `alert` | one primary block button with `home` "Back to Home" (the only way out) |

Button rows: gap 12, 6 pt extra top margin, each 1 1 120 pt; they stack at 200 % text.

## States and variants

The hold fill is a functional 2 s timer that Reduce motion never skips; VoiceOver users confirm with an accessibility action instead. Releasing early empties the fill.

The three dialogs the design draws are parity frames, each opened once on mount by the model hook that owns it, through the same handler a player's action uses (`app/use-parity-opener.ts`: the frame state is read once and the handler runs from one effect through `useEffectEvent`):

| Frame | Opened by | How |
|---|---|---|
| `s14-reset-all-progress` (state `reset-progress-dialog-held`) | S11's `use-settings-extras.ts` | the Reset all progress row's request with `frozenProgress: 0.46`: `DialogHost` passes it to `ResetProgressDialog`, which passes it to the Toybox `HoldButton`; `useHoldToConfirm` starts the fill there and a press neither fills nor confirms, so the key shows 46 % held as the design draws it |
| `s14-restart-to-apply` (state `restart-dialog`) | S11a's `use-settings-language-model.ts` | the dialog a direction flip opens (restart towards the other direction), without saving a language, so the screen underneath keeps the frame's language |
| `s14-progress-restored` (state `save-restored-dialog`) | S4's `use-home-model.ts` | `{ kind: 'save-restored' }` over Home |

Each has a test with a parity session (`startParitySession`): the dialog request is sent exactly once, and never on a normal launch.

## Data the model supplies

Each dialog takes its callbacks and `isReducedMotion` as props (`ResetProgressDialogProps`, `RestartDialogProps`, …); the dialog host above the navigator decides which one shows. The design and spec leave the host open; the default ships as templates (Chosen, say so in the report): `DialogProvider` (`app/dialog-context.tsx`) wraps `NavigationRoot` inside the other providers and draws `DialogHost` (`screens/dialogs/dialog-host.tsx`) after it, so the one open dialog sits above every screen. Its state is plain React state holding a `DialogRequest` (`screens/dialogs/dialog-request.ts`: a union by `kind` carrying that dialog's one action: `reset-stats`, `reset-progress` (with an optional test-build `frozenProgress` for its parity frame), `restart-to-apply`, `restart-level`, `save-restored`, `newer-save`). A screen model opens one with `useOpenDialog()({ kind: 'reset-stats', onConfirm: useSettingsResets().onConfirmResetStats })`; the two save dialogs are opened by the composition root instead (game-host-integration's `LoadOutcomeOpener` in the dialog host, from the save's load outcome: `save-restored` after a backup restore, `newer-save` for a save from a newer app version); the action button runs its callback, then closes; Cancel, Later and OK only close. It is never persisted and never a route (no store: `ShellStores` holds exactly the four domain stores). `DialogFrame` sets `<scope>.scrim` (Scrim, which also centres the card 28 / 20 pt from the edges) and `<scope>.art` (ArtTile; `size="dialog"` is the 56 pt reset art), and passes `testIDBase={scope}` to the Toybox `DialogCard`, which derives `<scope>.card`, `.title` and `.body`. Reset all progress uses the Toybox `HoldButton` (it owns the 2 s timer, the `.fill` part and the VoiceOver `activate` action). Two-button rows use `DialogButtonRow` (`<scope>.buttons`) with `isInRow` buttons, the Chosen restart-level and newer-save rows included (their ids are in the map's `notDrawn`). The crash card carries DialogCard's `crash.card`, `crash.title` and `crash.body` (`notDrawn` too).

The two reset dialogs only confirm; the reset itself is settings-and-preferences' `useSettingsResets()`: `onConfirmResetStats` and `onConfirmResetProgress` each write ONE `updateAndPublish(save, stores, { recipe, refreshBackup: true })`, so every section store re-reads the save and Home, Levels, Daily and Statistics show the reset at once (a bare `save.update` would leave them stale; `check-settings.mjs` reports it as `reset-publish`). The dialog host passes those handlers as `onConfirm` and closes the dialog after them. `CrashScreen` keeps react-components-and-hooks' `{ onGoHome }` props and reads Reduce motion from the phone only.

## Templates

Copy each file from `templates/` to the same path in the app repo; the code lives in `packages/shell/src/screens/dialogs/` and `packages/shell/src/app/crash-screen.tsx`.

- `packages/shell/src/screens/dialogs/dialog-frame.tsx`
- `packages/shell/src/screens/dialogs/dialog-request.ts`
- `packages/shell/src/screens/dialogs/dialog-host.tsx`
- `packages/shell/src/screens/dialogs/dialog-host.test.tsx`
- `packages/shell/src/app/dialog-context.tsx`
- `packages/shell/src/app/dialog-context.test.tsx`
- `packages/shell/src/screens/dialogs/newer-save-dialog.tsx`
- `packages/shell/src/screens/dialogs/reset-progress-dialog.tsx`
- `packages/shell/src/screens/dialogs/reset-stats-dialog.tsx`
- `packages/shell/src/screens/dialogs/restart-dialog.tsx`
- `packages/shell/src/screens/dialogs/restart-level-dialog.tsx`
- `packages/shell/src/screens/dialogs/save-restored-dialog.tsx`
- `packages/shell/src/app/crash-screen.tsx`
- `packages/shell/src/app/crash-screen.test.tsx`
- `packages/shell/src/screens/dialogs/dialogs.test.tsx`

## testIDs

Exactly these, from the shared screen map (`assets/screen-testids.json`). Set the testID in the first column; the parts in the last column are drawn by that component from it. `<n>` is a stable data key (a level number, a language code, a stat id), never a list index; the only numbered series are the week columns and bars (`daily.week-day.1..7`, `stats.week-bar.1..7`: position, 1 = the oldest day, 7 = today), which WeekStrip and WeekBars number themselves. Components that take a base prop (`testIDBase`, `dayTestIDBase`, `barTestIDBase`, `segmentTestIDBase`) derive the rows marked "drawn by"; pass the base exactly (see component-contract.md). `node ${CLAUDE_SKILL_DIR}/scripts/list-screen.mjs S14` prints every element with its English text.

Map note: The screen underneath (Settings, Language, Home) keeps its own testIDs from its own entry; only the dialog is listed here.

| testID | Component (kind) | Role | Copy key | Variants, requires | Parts the component draws |
|---|---|---|---|---|---|
| `reset-progress-dialog.scrim` | Scrim | none |  | reset-progress |  |
| `reset-progress-dialog.card` | DialogCard | none |  | reset-progress | (drawn by DialogCard from its `testIDBase`) |
| `reset-progress-dialog.art` | ArtTile (danger 56, trash) | none |  | reset-progress |  |
| `reset-progress-dialog.title` | AppText | header | `dialog.reset-progress.title` | reset-progress | (drawn by DialogCard from `testIDBase="reset-progress-dialog"`) |
| `reset-progress-dialog.body` | AppText | text | `dialog.reset-progress.body` | reset-progress | (drawn by DialogCard from `testIDBase="reset-progress-dialog"`) |
| `reset-progress-dialog.confirm-button` | Button (danger block hold, trash icon) | button | `dialog.reset-progress.confirm` | reset-progress | .fill |
| `reset-progress-dialog.hold-hint` | AppText | text | `dialog.reset-progress.hold-hint` | reset-progress |  |
| `reset-progress-dialog.cancel-button` | Button (secondary block) | button | `common.cancel` | reset-progress |  |
| `restart-dialog.scrim` | Scrim | none |  | restart |  |
| `restart-dialog.card` | DialogCard | none |  | restart | (drawn by DialogCard from its `testIDBase`) |
| `restart-dialog.art` | ArtTile (pop, globe) | none |  | restart |  |
| `restart-dialog.title` | AppText | header | `settings.language.restart.title` | restart | (drawn by DialogCard from `testIDBase="restart-dialog"`) |
| `restart-dialog.body` | AppText | text | `settings.language.restart.body` | restart | (drawn by DialogCard from `testIDBase="restart-dialog"`) |
| `restart-dialog.buttons` | View | none |  | restart |  |
| `restart-dialog.later-button` | Button (secondary) | button | `settings.language.restart.later` | restart |  |
| `restart-dialog.restart-button` | Button (primary, restore icon) | button | `settings.language.restart.confirm` | restart |  |
| `save-restored-dialog.scrim` | Scrim | none |  | save-restored |  |
| `save-restored-dialog.card` | DialogCard | none |  | save-restored | (drawn by DialogCard from its `testIDBase`) |
| `save-restored-dialog.art` | ArtTile (gold, restore) | none |  | save-restored |  |
| `save-restored-dialog.title` | AppText | header | `dialog.save-restored.title` | save-restored | (drawn by DialogCard from `testIDBase="save-restored-dialog"`) |
| `save-restored-dialog.body` | AppText | text | `dialog.save-restored.body` | save-restored | (drawn by DialogCard from `testIDBase="save-restored-dialog"`) |
| `save-restored-dialog.buttons` | View | none |  | save-restored |  |
| `save-restored-dialog.ok-button` | Button (primary) | button | `common.ok` | save-restored |  |

Chosen states the design does not draw may also set: `restart-level-dialog.restart-button`, `restart-level-dialog.scrim`, `restart-level-dialog.card`, `restart-level-dialog.title`, `restart-level-dialog.body`, `restart-level-dialog.cancel-button`, `reset-stats-dialog.confirm-button`, `reset-stats-dialog.scrim`, `reset-stats-dialog.card`, `reset-stats-dialog.art`, `reset-stats-dialog.title`, `reset-stats-dialog.body`, `reset-stats-dialog.cancel-button`, `newer-save-dialog.update-button`, `newer-save-dialog.scrim`, `newer-save-dialog.card`, `newer-save-dialog.art`, `newer-save-dialog.title`, `newer-save-dialog.body`, `newer-save-dialog.later-button`, `crash.home-button`, `crash.screen`.

## Copy keys

| Key | English |
|---|---|
| `dialog.reset-progress.title` | Reset all progress? |
| `dialog.reset-progress.body` | This deletes your levels, stars, daily results and statistics. Premium, language and settings stay. This can’t be undone. |
| `dialog.reset-progress.confirm` | Hold to reset |
| `dialog.reset-progress.hold-hint` | Keep holding for {seconds, plural, one {# second} other {# seconds}}. |
| `common.cancel` | Cancel |
| `settings.language.restart.title` | Restart to apply |
| `settings.language.restart.body` | The layout direction changes after a quick restart. Your progress is saved. |
| `settings.language.restart.later` | Not now |
| `settings.language.restart.confirm` | Restart now |
| `dialog.save-restored.title` | Progress restored |
| `dialog.save-restored.body` | Your progress couldn’t be loaded. A backup copy was restored. |
| `common.ok` | OK |

## Reference images

- `assets/reference/s14-reset-all-progress.png` (reset-progress; phone)
- `assets/reference/s14-restart-to-apply.png` (restart; phone)
- `assets/reference/s14-progress-restored.png` (save-restored; phone)

Open the image before building and compare the finished screen with it (toybox-visual-parity runs the exact comparison).

## Pitfalls

- The action at the start and the safe choice at the end.
- An accent (primary) button for a destructive action: danger buttons keep the surface fill and turn text, icon and edge danger.
- A dialog without a way out, a banner or a sticker in a dialog.
