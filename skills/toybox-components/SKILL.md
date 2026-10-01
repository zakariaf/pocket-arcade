---
name: toybox-components
description: Builds the Pocket Arcade Toybox components - buttons, hero key, rows, toggles, sliders, level tiles, stickers, dialogs, toasts, top bars, stats - with testIDs, a11y and tests. Use when adding or restyling a Toybox part. Not for hooks (react-components-and-hooks) or tokens (toybox-design-system).
---

# Toybox components

Gives the Pocket Arcade Shell every part the Toybox design draws: 53 presentational components in `packages/shell/src/ui/`, each with the exact Toybox measurements, its states, its accessibility role and the testID parts the design's element map expects, plus a test. A script proves the repo has them all and keeps the component rules.

## Rules that must hold

1. **Measurements come from `COMPONENT_SPECS`, which `write-component-specs.mjs` derives from the Toybox token file as the references render it.** Every CSS border is floored the way Chrome drew the references (2.5 -> 2, 1.5 -> 1; rings and icon strokes keep their values), and a commented override table covers where the mockup CSS differs (group tab flush: `marginStart` 0, `overlap` 0; segmented control `faceGap` 1, `labelColumnGap` 3). A retyped number drifts silently; the JSON and the token file are never edited by hand.
2. **Raised means pressable, and `RaisedSurface` is the only press.** Keys sink into their hard shadow; panels, lists, rows, chips, toasts and stickers lie flat. `Pressable` appears only in `raised-surface`, `quiet-button` and `list-row`; no opacity presses, no `hitSlop`. Those three hosts run `usePressFeedback()` on every press (the Shell's tap sound), except a switch, whose handler plays the toggle feedback; so every button sounds without a screen doing anything.
3. **Every component a test or screen addresses takes a required `testID` (or `testIDBase`) and derives its parts** (`.label`, `.value`, `.card`, `.fill`...). The ids match the design's element map, so Maestro and the parity harness find them without renaming. The component's own id sits on the box the design measures: a tab, chip or sticker View gets the testID with `accessible`, role and label, never its inner AppText (`testid-on-inner-text`).
4. **Every pressable has a role, a translated name, its state and a box of at least 44 pt.** Holds get a screen-reader action; charts and marks are labelled images; headings pass `isHeader`. Decorative parts hide themselves (`accessibilityElementsHidden` + `importantForAccessibility="no-hide-descendants"`): icon and art tiles, Premium art, confetti, the calendar tile, pager dots, radio marks, the toggle graphic, and unlabelled stars, marks and loaders. That is also the parity policy: Maestro never lists them, so the screen map marks them crop-only and judges their pixels in their cover's crop; never un-hide one to make it measurable.
5. **Components are presentational.** Props in, JSX out: no stores, screens, services or `t()` in `ui/`; strings arrive translated and numbers formatted in the chosen digits. The one injected behaviour is the press feedback, read from `@e07/shell/app/press-feedback-context.tsx` (a context ShellApp provides; silent without it, so component tests need no audio fake).
6. **Shape before colour.** Every state keeps its non-colour cue: check or dash, dashed edge and padlock, filled vs hollow star, pushed-in depth.
7. **Motion follows the Toybox table and takes `isReducedMotion` from the screen.** No squash, loops or slaps under reduce motion; the 2 s hold-to-confirm timer passes `ReduceMotion.Never`.
8. **Only printed parts tilt** (stickers, flags, art and logo tiles, the calendar, result stars, confetti); keys, panels and rows stay square. Tilt never mirrors in RTL; rows, fills and marks do, through logical styles.
9. **Every component has a test** that renders it through the Shell test wrapper and asserts role, name, state and its parts, ending with no inaccessible pressables.
10. **Never build the mock-only parts** (consent bottom sheet, board placeholder, ad box and "Ad" chip).

## Workflow

1. Read [references/component-catalogue.md](references/component-catalogue.md): the 53 components, their files, the prerequisites and which screen uses what.
2. **Check the prerequisites.** The theme modules, `AppText`, `RaisedSurface`, `toybox-styles.ts` and `Icon` must exist (they ship with the Toybox theme and the icon set). Run `node ${CLAUDE_SKILL_DIR}/scripts/check-components.mjs . --only Button`; a `prerequisite-missing` line names what to set up first.
3. **Write the measurements.** From the repo root run `node ${CLAUDE_SKILL_DIR}/scripts/write-component-specs.mjs .` (the as-rendered specs: [building-a-component.md](references/building-a-component.md), "Measurements"), then copy `templates/packages/shell/src/ui/component-specs.ts`, `button-paint.ts`, `use-hold-to-confirm.ts` with its test and `use-banner-band-style.ts` (the band itself has no negative margin: Home and Statistics pin the banner slot under the body, outside its gutters; Levels closes its body column with it, in a wrapper with `marginTop: 'auto'` and `marginInline: -20`; see [levels-bars-overlays.md](references/levels-bars-overlays.md), "Banner band").
4. **Copy the components you need** (all 53 for a new Shell) with their tests from `templates/packages/shell/src/ui/` to the same path. Keep the values; adapt only imports that differ in the repo. Before changing a component read its reference: [keys-and-inputs.md](references/keys-and-inputs.md), [lists-and-surfaces.md](references/lists-and-surfaces.md), [levels-bars-overlays.md](references/levels-bars-overlays.md) or [data-displays.md](references/data-displays.md). Compare with the design crop in `assets/reference/` named there.
5. **Replace pre-Toybox primitives.** If the repo has `ui/primary-button.tsx` or `ui/tile-button.tsx`, move their callers to `Button` / `LevelTile` as [references/building-a-component.md](references/building-a-component.md) ("Replacing pre-Toybox primitives") shows, then delete them and say so in the report.
6. **Wire components into screens** with the ids from [references/testids-and-accessibility.md](references/testids-and-accessibility.md): pass translated strings, formatted numbers, `isReducedMotion` and the scope ids; imitate [examples/sound-group.tsx](examples/sound-group.tsx) and its test.
7. **A new part or variant** follows [references/building-a-component.md](references/building-a-component.md): one file, `COMPONENT_SPECS`, `makeStyles`, `AppText`, `RaisedSurface`, required testID, a test. If it is a new catalogue entry, the owner updates the design first.
8. **Run the checks from the repo root** and loop until all pass: `npx tsc --noEmit -p packages/shell`, `npx eslint packages/shell/src --max-warnings 0`, `npx jest --ci`, then `node ${CLAUDE_SKILL_DIR}/scripts/check-components.mjs .` (use `--only <Name>` while building a subset, never at the end). Every `FAIL` line names the file, the rule and the fix.
9. **Report** in plain words which components were added or changed, which checks passed, which pre-Toybox files were removed, and any open issue touched ([references/decisions-and-open-issues.md](references/decisions-and-open-issues.md)).

## Definition of done

- [ ] `packages/shell/src/ui/component-specs.json` equals the as-rendered specs derived from the token file (borders 2, not 2.5; the group-tab and segmented-control overrides): `node ${CLAUDE_SKILL_DIR}/scripts/write-component-specs.mjs . --check` prints `RESULT: PASS`.
- [ ] Group tab, chip and sticker carry their testID on the measured View; the sticker pads 9 left / 11 right in both directions; `ListRow` has `isStrong`; the banner band spans the window (no negative margin in the band); the controls, lists, tiles, small-parts and bars tests pass.
- [ ] `KeyButton` and `ToggleKey` grow into their pair cells (`layoutStyle` `{ flexGrow: 1 }`, never `flex: 1`); the locked pack panel keeps the ink edge (dashed, on `sunken`); `ScorePanel` takes `line: { kind: 'moves' | 'score', text }` and derives `.moves-line` or `.score-line`, and draws New best as the gold `sm` sticker tilted +6°; `HoldButton` and `useHoldToConfirm` take `frozenProgress`; `levelNumber` and `scoreValue` are 1 / 1.45 (the theme's `type-styles.ts`).
- [ ] The device fixes hold: the `Scrim` is the modal root (never `DialogCard`); `QuietButton` draws its 2 pt underline (no `textDecorationLine`, no underlined nudge style); the hold fill sits in a track pinned to the face edges; the confetti band is `direction: 'ltr'` and `Confetti` takes `isHiddenBySetting`; dialog-row keys stretch (`isStretched`); `ListRow` has `alignContent: 'center'`, `textExtra`, `descriptionTestID` and `IconTileIcon` icons; `NotePanel` has `iconTile`, a top-aligned icon, `rowLabelStrong` strong text and one-line shrink; `StatList` uses `statListHeading` and Chrome's baselines (`text-metrics.ts`, `use-chrome-baseline.ts`); the Today tag overflows its column; the legend gap is 6; `OptionCard` centres its badge and ends an autonym of the other direction.
- [ ] All 53 component files exist with their named export, a required testID prop and a test that imports them.
- [ ] No `Pressable`, `Touchable*` or gesture-handler button outside the three allowed files, no opacity press, no `hitSlop`, no tilt on keys or panels, no literal sizes in component styles, no shadow on flat parts.
- [ ] The three press hosts run the tap feedback (not for switches); every decorative part hides itself from VoiceOver; tiles that hold text grow with it (`minHeight`, never a fixed `height`).
- [ ] Screens pass the element-map ids; each component test ends with `findInaccessiblePressables(...)` equal to `[]` where it renders a pressable.
- [ ] `npx tsc --noEmit`, `npx eslint --max-warnings 0` and `npx jest --ci` pass for the Shell.
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/check-components.mjs .` prints `RESULT: PASS`

## Anti-patterns

- **A "quick" `TouchableOpacity` or opacity press.** Toybox keys sink and spring; compose `RaisedSurface` or use `Button`, `ListRow` or `QuietButton`.
- **A shadow on a card to make it look important.** Raised promises a press; put a button inside the panel instead.
- **Building an id in the screen for a part** (`'home.endless-card' + '.label'` by hand, or an index key). Pass the base id and let the component derive its parts; key repeated items by data.
- **Calling `t()` or reading a store inside `ui/`.** The component becomes untestable and language-bound; the screen model builds the strings.
- **Hiding a hold behind a gesture only.** Screen-reader users need the `activate` action; the timer must ignore Reduce motion.
- **Editing `component-specs.json` to make a layout fit.** Fix the layout; the measurements change only with the design. When the design references and the token file disagree, add a commented entry (with the mockup rule) to `MOCKUP_OVERRIDES` in `scripts/lib/component-source.mjs` and regenerate.
- **A testID on the text inside a tab, chip or sticker.** Maestro then measures only the words; put it (with `accessible`, role and label) on the View the design measures.
- **Cancelling the body gutters in the banner band itself** (`marginInline: -20`). The band came out 40 pt too wide. On Home and Statistics the slot sits outside the gutters; on Levels the screen's wrapper around the slot cancels them once.
- **`flex: 1` on a key inside a pair-layout cell.** It is a zero vertical basis there: the Pause toggle row measured 0 pt on the device and the keys covered the Home button. Use `{ flexGrow: 1 }`.
- **Centring a chip or sticker with `alignItems: 'center'` on its parent.** Both set `alignSelf: 'flex-start'` on themselves, which wins; wrap them in a row with `justifyContent: 'center'`.
- **Printing "12 moves" for a score-rated level.** Pass `line={{ kind: 'score', text }}` (`result.win.score-line`); `result.win.moves-count` is retired.
- **Drawing the mockup's stand-ins** (Ad chip, 320 × 50 box, consent sheet, board placeholder).
- **Treating a green checker as proof that a screen looks right.** It proves structure and rules; the look is proven by comparing screenshots with the design.
- **`accessibilityViewIsModal` on the dialog card.** It hides the scrim's testID and the screen under it from the accessibility tree, so Maestro and the parity capture never reach the dialog; the `Scrim` is the modal root.
- **`textDecorationLine: 'underline'` for a quiet button.** iOS draws 1 pt at its own depth where the design draws 2 pt, 5 pt under the text; `QuietButton` draws the bar.
- **A percentage width on an absolute child of a padded face.** Yoga takes it inside the padding (the hold fill ended 16 pt short); put the fill in a track pinned to the face edges.
- **Placing confetti or any scatter with `start: x` and no `direction: 'ltr'`.** It mirrors in fa and ckb, while the design scatters from the left in every language.
- **A fixed `height` on a face that holds text** (the level tile had `height: 62`). At 200 % text the number clips; use `minHeight` from `COMPONENT_SPECS`.
- **Playing a UI sound from a component or a screen.** The press hosts already play the tap; a switch's handler plays the toggle. A second call doubles the sound.

## Files in this skill

| File | What it is | Read/run when |
|---|---|---|
| [references/component-catalogue.md](references/component-catalogue.md) | The 53 components, prerequisites, support files, owners, mock-only parts, screen usage | Workflow step 1, every time |
| [references/keys-and-inputs.md](references/keys-and-inputs.md) | Press model; buttons, hero key, row button, keys, icon button, busy blocks, pause key, toggle, segmented control, slider, progress bar, option card, radio | Working on a key or an input |
| [references/lists-and-surfaces.md](references/lists-and-surfaces.md) | Lists, rows, group tab, icon tile, panels, note panel, offer box, sticker, chip, art tile, Premium art, confetti | Working on a flat part |
| [references/levels-bars-overlays.md](references/levels-bars-overlays.md) | Level tile, stars, top bars, banner band, scrim, dialog, hold-to-confirm, toast | Levels, bars, dialogs, toasts |
| [references/data-displays.md](references/data-displays.md) | Calendar tile, week strip and legend, stat grid and list, score panel, week bars, how-to stage, pager dots, empty state, mock-only parts | Daily, Statistics, Result, How to play |
| [references/testids-and-accessibility.md](references/testids-and-accessibility.md) | testID grammar, parts per component, a11y rules, roles, pressable checklist | Wiring screens, writing tests |
| [references/building-a-component.md](references/building-a-component.md) | File anatomy, specs, paint, RaisedSurface, motion, tests, lint limits, replacing pre-Toybox primitives | A new part, workflow step 5 |
| [references/decisions-and-open-issues.md](references/decisions-and-open-issues.md) | Chosen values, undrawn states, open owner questions | Reporting, before changing a value |
| `templates/packages/shell/src/ui/` | The 53 components, `component-specs.json` / `.ts`, `button-paint.ts`, `use-hold-to-confirm.ts` (with `frozenProgress`) and `use-hold-to-confirm.test.ts` (both synced from the library, identical to react-components-and-hooks' copy; do not edit here), `use-banner-band-style.ts` (the band look screens pass to `AdBannerSlot`), `text-metrics.ts` and `use-chrome-baseline.ts` (Chrome's baselines for `StatList`, each with its test) and 10 component test files | Workflow steps 3 and 4 (copy) |
| [examples/sound-group.tsx](examples/sound-group.tsx) | A settings group wired from ListGroup, ListRow, SubRow and Slider with element-map ids | Workflow step 6 |
| [examples/sound-group.test.tsx](examples/sound-group.test.tsx) | Its test (switch rows, adjustable slider, inaccessible pressables) | Workflow step 6 |
| `scripts/check-components.mjs` | Checker: prerequisites, as-rendered specs, component files, exports, testIDs (and `testid-on-inner-text`), tests, component rules, decorative parts hidden, press hosts with tap feedback, keys that grow in pair cells (`pair-cell-flex`), the ink edge of the locked pack (`locked-pack-edge`), the Scrim as the modal root (`modal-root`), the drawn quiet underline (`quiet-underline`), the hold fill's track (`hold-fill-track`), confetti that never mirrors (`confetti-ltr`) | Workflow step 8 and at the end |
| `scripts/write-component-specs.mjs` | Generator: `component-specs.json`, as rendered, from the token file (`--check` compares and names the first difference and why) | Workflow step 3 |
| `scripts/lib/component-source.mjs` | Catalogue loading, the as-rendered spec derivation (`asRenderedBorder`, `MOCKUP_OVERRIDES`), JSX and source scanners (used by the scripts) | When a reference disagrees with the token file |
| `scripts/selftest.mjs` | Proves both scripts on good and planted-bad fixtures | After changing a script |
| `scripts/check-lib.mjs` | Shared script helper, synced from the library (do not edit here) | Never by hand |
| `assets/component-catalogue.json` | The catalogue as data (files, roles, testID props, parts, allowlists) | Read by the checker; look up a part |
| `assets/toybox-tokens.json` | The Toybox token file (its `components` block is the source of the specs) | Read by the scripts; look up a value |
| `assets/reference/` | Design crops: light buttons, hero key, toggle, segmented control, slider, list rows, flat card, level tiles, star rating, top bar, banner slot, dialog, toast, stickers; dark buttons, list rows, level tiles, dialog | Comparing a built component |
| `assets/shared.json` | Declares the shared files this skill copies in (check-lib, the token file, `use-hold-to-confirm.ts` and its test) | When adding a shared file |
| `tests/fixtures/` | Good and planted-bad inputs for the self-test | When adding a rule to a script |

## Related skills

- `toybox-design-system` - the theme, `AppText`, `RaisedSurface` and style bans these components build on.
- `code-drawn-art-and-icons` - `Icon`, `LogoTile`, the empty-stats picture and the hazard strip.
- `toybox-screens` - the S1 to S15 layouts that compose these components.
- `toybox-visual-parity` - proves a built screen matches its design screenshot.
- `accessibility` - screen-level VoiceOver, 200 % text and contrast work beyond single components.
