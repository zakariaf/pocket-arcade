---
name: accessibility
description: Makes Pocket Arcade UI accessible - VoiceOver roles, translated labels, 44 pt targets, 200% text, WCAG contrast, colour-blind checks, reduce motion, board summaries. Use when building or reviewing UI, piece colours or motion. Not for palette values (toybox-design-system) or RTL (rtl-and-direction).
---

# Accessibility

Every control is reachable and named for VoiceOver in four languages, every target is at least 44 pt, text grows to 200 % without clipping, every palette meets WCAG 2.2 AA the Toybox way, motion respects the setting, and boards speak a summary; scripts and tests prove what a machine can see, and the owner's VoiceOver pass covers the rest.

## Rules that must hold

1. **Give every interactive element a role and a translated name** (`t()`), a hint only when the outcome is not obvious, and its state in `accessibilityState` (also set `disabled`). Why: VoiceOver reads role, name and state; RNTL's `getByRole` finds exactly that.
2. **Make every touch target's own box at least 44 × 44 pt (`MIN_TOUCH`); never `hitSlop`.** Why: Apple's minimum and the product rule; `hitSlop` is invisible in layout and overlaps neighbours.
3. **Let text grow to 200 %:** `AppText` with `maxFontSizeMultiplier={2}`, never `allowFontScaling={false}`, `minHeight` instead of `height`, no `numberOfLines` on sentences, rows that stack when `isLargeText`. Why: the product promises 200 % text that reflows instead of cutting off.
4. **Meet WCAG 2.2 AA with the Toybox pair set in every mode and scheme** (4.5:1 text, 3:1 icons, outlines and focus); put danger text only on `surface` or `dangerFill`; `danger` on `dangerFill` is a 4.5 text pair in both schemes, with no exception (the hold label stays on the key while the fill grows under it; owner decision O5 made the light `dangerFill` `#FFDCDF`, 4.52:1). Why: Toybox fills sit close to the ground on purpose and the ink outline is the boundary, so the old pair set fails every Toybox palette.
5. **Never convey meaning by colour alone;** every board declares its colour pairs and piece colours in `board-contrast.json`, the pairs meet 4.5:1 (text) or 3:1 (graphics, edged shapes) in all four board sets, the piece colours stay ≥ 0.07 apart in OKLab under protan, deutan and tritan simulation in the colour-blind sets, and every state has a shape cue. Why: colour-blind players must play every game, and a board palette alone does not say which colour sits on which.
6. **Honour reduce motion through `useReduceMotion()` and `<MotionConfig />`**, with the Toybox alternatives (fades, no squash, no loops); functional timers keep `ReduceMotion.Never`. Why: Reanimated's own hook is a module-load constant and ignores the Settings row.
7. **Expose each board as one `image` labelled with `t()` of `board.describe(view)`, and announce events with `useAnnounce()`.** Why: Skia content is invisible to VoiceOver, and announcements must only speak while VoiceOver runs.
8. **Keep VoiceOver order equal to visual order; overlays set `accessibilityViewIsModal` on their root (the `Scrim` for every Toybox dialog, never the card inside it); never nest an accessible pressable in another (a card that opens a screen and holds its own key is two sibling elements); other-language text sets `accessibilityLanguage`;** settings rows are one element, sliders are `adjustable`, holds have an alternative. Why: otherwise VoiceOver wanders behind dialogs, reads Persian with an English voice, and cannot use sliders or holds.
9. **Query by role and name in tests, and end every screen test with the `findInaccessiblePressables` audit.** Why: a missing role or name then fails a test instead of a player.
10. **Leave the spoken-output judgement to the owner's VoiceOver checklist on each release candidate (en and fa).** Why: automated checks cannot tell whether what VoiceOver says makes sense.
11. **Never change a design colour or pass `--allow` to make a contrast check pass;** fix the code, or ask the owner. `check-contrast` keeps no exception for any pair, the hold-to-confirm label included. Why: design colours are the owner's call, and the references match them exactly.

## Workflow

1. **First time.** Copy `templates/shell-theme/` to `packages/shell/src/theme/`, `templates/shell-testing/` to `packages/shell/src/testing/`, and `templates/shell-app/` to `packages/shell/src/app/`. Call `watchSystemA11y(onError)` once in the root providers (a mount effect that returns its unsubscribe) and render `<MotionConfig />` at the root. Add the `a11y` keys to `quality-gates.json` (`minTouchPt` 44, `maxFontScale` 2, `textContrastMin` 4.5, `nonTextContrastMin` 3, `minCvdDistanceOk` 0.07).
2. **Building or changing a component or screen.** Read [references/roles-labels-and-voiceover.md](references/roles-labels-and-voiceover.md) and follow [examples/accessible-level-tile.md](examples/accessible-level-tile.md): Shell `ui/` buttons only, labels from `t()` in the model hook, the right role and state, a 44 pt box, headers with `isHeader`, overlays modal.
3. **A palette, a new game or piece colours.** Read [references/contrast-and-colour.md](references/contrast-and-colour.md). Make sure the board has `apps/<game-id>/src/board/board-contrast.json` beside its `board-palettes.json` (the board template ships one; list the text, graphics and edged-shape pairs its `draw()` paints and the piece or kind tokens that must stay apart under `distinct`). Copy `templates/root-test/palette-a11y.test.ts` to `test/integration/a11y/<game-id>-palette.test.ts` and replace `__GAME_ID__`: it checks the game's Toybox palette and reads the `distinct` lists from `board-contrast.json` and their colours from the colour-blind sets of `board-palettes.json`, so there is nothing else to fill in. Run `node ${CLAUDE_SKILL_DIR}/scripts/check-contrast.mjs . --palette apps/<game-id>/src/board/board-palettes.json`.
4. **Large text and motion.** Read [references/text-scaling-and-motion.md](references/text-scaling-and-motion.md): stack at `isLargeText`, grow tiles with `fontScale`, give each animation its reduce-motion alternative.
5. **Boards.** Label the board canvas from `board.describe(view)` through `t()`; announce results and important events with `useAnnounce()`, one short announcement per move.
6. **Tests.** Read [references/testing-accessibility.md](references/testing-accessibility.md). Query by role and name, assert state, and end every screen test with the audit line.
7. **Run the checks** from the repo root, fix every `FAIL` line (each names the file, the rule and the fix) and rerun until both print `RESULT: PASS`:
   - `node ${CLAUDE_SKILL_DIR}/scripts/check-a11y-code.mjs .`
   - `node ${CLAUDE_SKILL_DIR}/scripts/check-contrast.mjs .` (every `apps/*/src/theme/palette.ts`, every `apps/*/src/board/board-palettes.json` with its `board-contrast.json`, the Shell colours and the a11y gates)
   A contrast failure on a design colour is a question for the owner (rule 11), never an `--allow`.
8. **Large text on the simulator.** Copy `templates/e2e/01-large-text-core-screens.yaml` to `packages/shell/e2e/flows/a11y/`. `npm run e2e:ios -- --app <game>` (the e2e-maestro runner) runs every `a11y` flow at `accessibility-extra-extra-extra-large` in en and fa on the phone and the iPad; read every screenshot under `reports/e2e/<game>/large-text/` for clipping, overlap and missing stacking, and compare with the Toybox design (layout and colours must still match it).
9. **Before a release (human step).** Ask the owner to run the VoiceOver checklist in the testing reference on the release candidate in English and Persian; turn every reported problem into a failing test first.

## Definition of done

- [ ] Every pressable has a role, a translated name, its state, and a box of at least 44 × 44 pt without `hitSlop`; labels and hints come from `t()`.
- [ ] Text scales to 200 %: no `allowFontScaling={false}`, no other cap, no fixed heights around text, rows stack at `isLargeText`; the a11y Maestro flow's screenshots in en and fa show nothing clipped.
- [ ] Reduce motion goes through `useReduceMotion()` / `<MotionConfig />`; the board is one labelled image; announcements use `useAnnounce()`; overlays are modal.
- [ ] Every screen test queries by role and name and ends with `findInaccessiblePressables`; the template tests and each game's palette test pass.
- [ ] Every board has a `board-contrast.json`; its pairs pass in all four board sets, its `distinct` piece colours pass the colour-blind check in both colour-blind sets (and in the game's palette test), and every state has a shape cue.
- [ ] Danger, text and muted text on `dangerFill` pass 4.5:1 in both schemes (the hold label in every fill state); no `--allow` anywhere.
- [ ] The owner has been asked for the release-candidate VoiceOver pass.
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/check-a11y-code.mjs .` prints `RESULT: PASS`.
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/check-contrast.mjs .` prints `RESULT: PASS`.

## Anti-patterns

- **A raw `Pressable` in a screen with a hard-coded English label.** Use the Shell's `ui/` buttons and pass `t('…')`.
- **`hitSlop={10}` on a 24 pt icon.** Make the button's own box 44 pt and centre the glyph.
- **Turning Dynamic Type off because a layout breaks at 200 %.** Stack the row, use `minHeight`, let it wrap.
- **"Fixing" contrast by darkening an accent fill until it passes against the ground.** Toybox relies on the ink outline; check the outline pair, and change design colours only with the owner.
- **Red vs green pieces with no symbol.** Pick from the colour-blind-safe set and draw a shape cue.
- **`useReducedMotion()` from Reanimated, or reading `AccessibilityInfo` in a screen.** It ignores the Settings row and live changes; use `useReduceMotion()` and the store.
- **Calling `announceForAccessibility` on every frame or every tap.** One short announcement per move, only while VoiceOver runs.
- **A key nested inside a card's `Pressable`.** VoiceOver reads the outer element and never reaches the key; make the card opener and the key siblings.
- **Labelling every star and icon inside a tile.** Give the tile one name; decorative parts stay silent.
- **Reporting "VoiceOver works" without the owner's checklist.** Automated checks cannot hear the output.

## Files in this skill

| File | What it is | Read/run when |
|---|---|---|
| [references/roles-labels-and-voiceover.md](references/roles-labels-and-voiceover.md) | Pressable checklist, Toybox roles and states, names and hints, 44 pt targets, grouping, a card that opens a screen plus its own key, sliders, holds, the board, announcements, overlays (the Scrim as the modal root), languages | Workflow steps 2 and 5 |
| [references/contrast-and-colour.md](references/contrast-and-colour.md) | WCAG maths, the Toybox pair set and why, the measured Toybox table, the hold label on `dangerFill` (owner decision O5), colour blindness and its calibration, focus | Workflow step 3 |
| [references/text-scaling-and-motion.md](references/text-scaling-and-motion.md) | fontScale table and the 2× cap, large-text layout rules, Toybox large-text layouts, reduce motion and the Toybox alternatives | Workflow step 4 |
| [references/testing-accessibility.md](references/testing-accessibility.md) | RNTL role queries and the audit, tests to keep, the Maestro large-text pass, the owner's VoiceOver checklist | Workflow steps 6, 8 and 9 |
| [examples/accessible-level-tile.md](examples/accessible-level-tile.md) | The level tile and grid with translated plural labels, a hint, shape cues and the audited test | Workflow step 2 |
| `templates/shell-theme/` | `contrast.ts` (WCAG 2.2) and `cvd.ts` (Machado + OKLab) | Workflow step 1; copy to `packages/shell/src/theme/` |
| `templates/shell-testing/` | `palette-checks.ts` (Toybox pair set, colour-blind check), `find-inaccessible-pressables.ts`, and their tests | Workflow step 1; copy to `packages/shell/src/testing/` |
| `templates/shell-app/` | `system-a11y-store.ts` (+ test; both synced from the library, the one shared copy), `use-reduce-motion.ts` (+ test; also true during a parity capture), `use-reduce-motion-setting.ts` (+ test; the saved choice or the phone switch, never frozen, read by the Settings row and the S15 debug model), `motion-config.tsx` (+ test), `use-announce.ts` (+ test) | Workflow step 1; copy to `packages/shell/src/app/` |
| `templates/root-test/palette-a11y.test.ts` | Per-game palette test (`__GAME_ID__`): the Toybox palette pairs, and the board's `distinct` colours read from `board-contrast.json` and the colour-blind sets of `board-palettes.json` | Workflow step 3; copy to `test/integration/a11y/` |
| `templates/e2e/01-large-text-core-screens.yaml` | Maestro flow for Home, Levels and Settings at 200 % text | Workflow step 8 |
| `scripts/check-a11y-code.mjs` | Checks 16 code rules: roles, names, 44 pt boxes, hitSlop, state, literal labels, font scaling, reduce motion, announcements, modal overlays (through the Scrim or an overlay root), nested pressables, the board image, holds, sliders, screen-test audits | Workflow step 7 |
| `scripts/check-contrast.mjs` | Checks Toybox palettes (or a tokens file), Shell colours (danger, text and muted text on dangerFill as 4.5 text pairs), board palettes against their `board-contrast.json` (text, graphics, edged shapes, colour-blind `distinct` lists; translucent colours composited), piece colours and the a11y gates | Workflow steps 3 and 7 |
| `scripts/lib/wcag.mjs` | Contrast and colour-blind maths and the pair set used by the checker | Read only when changing a rule |
| `scripts/lib/load-ts-constants.mjs` | Loads a data-only TypeScript module (palette, Shell colours) without packages | Read only when changing the checker |
| `scripts/lib/source-scan.mjs` | JSX, call and import scanning helpers | Read only when changing a checker |
| `scripts/selftest.mjs` | Proves both checkers pass their good fixtures and catch each planted bug | After changing a script or fixture |
| `scripts/check-lib.mjs` | Shared script helper, synced from the library (do not edit here) | Never by hand |
| `assets/toybox-tokens.json` | The Toybox design tokens (synced; do not edit here): every game's palette and the Shell colours | `check-contrast.mjs . --tokens assets/toybox-tokens.json` to re-measure the design |
| `assets/shared.json` | Declares the shared files this skill copies in | When adding a shared file |
| `tests/fixtures/` | Good and planted-bad inputs, one folder per checker (the contrast good fixture holds the design's danger colours, a Line Siege board palette and a `skills/` folder of planted palettes that must stay silent) | When adding a rule |

## Related skills

- `i18n-strings-and-catalogs` - the catalog keys behind every label and hint.
- `rtl-and-direction` - VoiceOver order and layout in Persian and Sorani.
- `toybox-components` - the buttons, rows and tiles these rules apply to.
- `toybox-design-system` - the palettes and motion tokens.
- `board-rendering-skia` - the board canvas, its summary and the reduced timeline.
- `performance-budgets` - frame, start-up and memory budgets.
