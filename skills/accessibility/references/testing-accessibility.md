# Testing accessibility

Automated checks catch missing roles, names, sizes and contrast; screenshots catch clipping at 200 %; only a person with VoiceOver can judge whether the spoken output makes sense. All three are required.

## Contents

- Component and screen tests (RNTL)
- The tests to keep
- Large text on the simulator (Maestro)
- The owner's VoiceOver checklist
- Turning a report into a test

## Component and screen tests (RNTL)

- Query by **role and name** first: `screen.getByRole('button', { name: 'Level 2: 1 star' })`, `getByRole('header', { name: 'Pack 1' })`. A missing role or name then fails the test, not a player. Names are the real English catalog text, because `renderWithShell` renders with the English catalog.
- Assert state with `toBeDisabled()`, `toBeBusy()`, `toBeChecked()`, `toBeSelected()`.
- End **every screen test** with the audit helper (`packages/shell/src/testing/find-inaccessible-pressables.ts`):

```tsx
expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
```

It walks the rendered host tree, finds every element with a press handler, and returns one message per missing role or accessible name (a label, or visible text inside), for example `zz.no-name: no accessible name` and `zz.no-role: no role`. It returns a list instead of calling `expect` because test globals are banned outside `*.test.ts(x)` files.

- The 44 × 44 pt box is one of the few style assertions tests may make: `expect(screen.getByRole('button', { name: 'Settings' })).toHaveStyle({ width: MIN_TOUCH, height: MIN_TOUCH })`.
- Hot components pin their re-render boundary with a `<Profiler>` test (performance work, not accessibility).

## The tests to keep

| Test (template) | Asserts |
|---|---|
| `palette-checks.test.ts` | the Toybox palette passes; too-light muted text, a lost outline and a fill with neither edge nor ground are flagged with pair and ratio; Okabe–Ito passes and a red/green set fails |
| `find-inaccessible-pressables.test.tsx` | a roleless and a nameless pressable are reported; the Shell buttons pass |
| `use-reduce-motion.test.ts` | the Settings row against the phone switch |
| `test/integration/a11y/<game>-palette.test.ts` (root, one per game) | the game's palette meets AA; its piece colours pass the colour-blind check |
| each screen's test | role/name queries and the audit line |

## Large text on the simulator (Maestro)

The `a11y`-tagged flows run at the largest text size, in en and fa, on the phone and iPad simulators. `npm run e2e:ios -- --app <game>` does this in its large-text step (the e2e-maestro runner: `--include-tags a11y`, `-e LANG=en` and `-e LANG=fa`, on `e07-e2e-phone` and `e07-e2e-tablet`), writes the reports and screenshots to `reports/e2e/<game>/large-text/<phone|tablet>-<en|fa>/`, and resets the size to `large` afterwards; its flows step leaves `a11y` flows out, because they need `LANG`. To run the pass by hand on one simulator (Java 17 as the runner finds it), name the device before the command (`--device`) and give the run its own driver port (`--driver-host-port`), as the runner does for every Maestro call (e2e-maestro's `packages/tooling/src/e2e/maestro-args.ts`): without them a hierarchy call can reach another session's simulator.

```sh
export JAVA_HOME="$(/usr/libexec/java_home -v 17 2>/dev/null || echo '/Applications/Android Studio.app/Contents/jbr/Contents/Home')"
export MAESTRO_CLI_NO_ANALYTICS=true MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true MAESTRO_DISABLE_UPDATE_CHECK=true
# UDID: your own simulator (named e07-<purpose>), never "booted" and never another session's.
# PORT: a free local port for this run's Maestro driver (listen on port 0 and read it back).
# BUNDLE_ID: io.applander.<gameId without hyphens>, all lowercase (Line Siege: io.applander.linesiege).
PORT="$(node -e "const s=require('node:net').createServer().listen(0,()=>{console.log(s.address().port);s.close();})")"
xcrun simctl ui "$UDID" content_size accessibility-extra-extra-extra-large
tools/maestro/bin/maestro --device "$UDID" --driver-host-port "$PORT" test packages/shell/e2e/flows/a11y --include-tags a11y \
  -e APP_ID="$BUNDLE_ID" -e APP_SCHEME="$APP_SCHEME" -e LANG=fa \
  --format JUNIT --output reports/e2e/a11y-fa.xml --test-output-dir reports/e2e/a11y-fa
xcrun simctl ui "$UDID" content_size large
```

- The flow is `templates/e2e/01-large-text-core-screens.yaml` (copy to `packages/shell/e2e/flows/a11y/`): Home, Levels and Settings at 200 % text, with screenshots. Its testIDs are the canonical ones (`home.play-button`, `home.levels-button`, `levels.level-tile.1`, `levels.top-bar.back-button`, `home.settings-button`, `settings.reset-progress-row`).
- Maestro 2.10.0 was verified on this simulator at `accessibility-extra-extra-extra-large`: `launchApp`, `assertVisible` and `tapOn` by `id`, and `takeScreenshot`.
- Read each screenshot (the Read tool) for clipped or overlapping text, truncated labels, and rows that should have stacked. The screenshot matrix also runs at this size (`npm run screenshots:ios -- --app <game> --text-size accessibility-extra-extra-extra-large`).

## The owner's VoiceOver checklist

A human step: the owner runs it once per release candidate, on a TestFlight build, in **English and Persian** (about 15 minutes). Tell the owner when a build is ready for it; do not claim it passed without the owner's report.

Setup, once: Settings → Accessibility → Accessibility Shortcut → VoiceOver; then a triple-click of the side button switches VoiceOver on and off. Gestures: swipe right = next, swipe left = previous, double-tap = activate, two-finger swipe up = read all, two-finger scrub ("Z") = back.

1. **Launch.** The first thing read is the screen's title. No element is read as just "button".
2. **Language screen (first launch):** each language name is spoken in its own language.
3. **Home:** swiping visits elements in visual order (in Persian, starting at the top right). The Play button reads like "Continue, level 12, button".
4. **Levels:** a tile reads its number and stars ("Level 3: 2 stars, button"). A locked tile says it is locked, and double-tapping it tells how to unlock it.
5. **Game:** the board reads its summary. After a move a short announcement is heard. Pause is reachable, and the two-finger scrub opens Pause instead of leaving the game.
6. **Pause and dialogs:** while open, VoiceOver cannot reach anything behind them.
7. **Settings:** switches say "on"/"off". Volume changes with a one-finger swipe up/down. "Reset all progress" can be confirmed without holding the button.
8. **Premium:** the price is read in the local currency, and "busy" is announced while a purchase is in progress.
9. **Result screen:** the result and the stars are read before the Next button.

## Turning a report into a test

The owner reports each problem as: screen, language, what was expected, what was heard. Turn each into a failing RNTL or Maestro test first (red), then fix it (green); report back with the test name as evidence.
