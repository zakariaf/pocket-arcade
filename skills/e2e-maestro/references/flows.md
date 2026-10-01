# Writing Maestro flows

Where flows live, how they are named and tagged, how they select elements and set up state, how a game flow taps its Skia board, and what to do when a flow is flaky.

## Contents

- Folders and names
- The header and tags
- Selecting elements: testIDs only
- Setting up state: the debug-setup sub-flow
- The shared sub-flows
- The Shell's flows
- A game's flows and board taps
- The level-1 flow: one move, a kill, a win, then the stars in Levels
- A game's mode flows: daily, continue, endless
- Taps and stars from the game: print-level-line
- Ending smoke flows: no network
- Waiting without sleeping
- Flaky flows and quarantine
- What a flow should not prove

## Folders and names

```
packages/shell/e2e/
  flows/<area>/<nn>-<name>.yaml      Shell journeys every game runs (nn 01-09)
  subflows/                          shared steps, never run on their own
  screenshots/matrix.yaml            run only by npm run screenshots:ios
  storekit/<nn>-<name>.yaml          premium-purchase Tier 2 flows, run only by its StoreKit harness
apps/<game-id>/e2e/
  flows/<area>/<nn>-<name>.yaml      the game's own flows (nn 10 and up)
  testids.json                       the game's own extra testIDs ({ "testIDs": { "<id>": "why" } } or a list),
                                     including the result.stars-<n> its flows assert
  baselines/<device>/<lang>-<theme>/<screen>.png
```

- Areas: `smoke`, `journeys`, `rtl`, `offline`, `a11y`, `premium`, ... one folder level only. The runner lists `packages/shell/e2e/flows/*/*.yaml` and `apps/<game-id>/e2e/flows/*/*.yaml` and sorts them.
- Relative paths: from a Shell flow `../../subflows/debug-setup.yaml`; from a game flow `../../../../../packages/shell/e2e/subflows/debug-setup.yaml`; from the matrix `../subflows/debug-setup.yaml`.

## The header and tags

```yaml
appId: ${APP_ID}
name: Core journey works offline and survives a kill
tags: [smoke, shell, offline]
---
- launchApp:
    clearState: true
```

- `appId: ${APP_ID}` always (the runner passes the bundle id with `-e APP_ID=...`). `name:` is a sentence saying what the journey proves; it becomes the JUnit test name in the evidence.
- Tags: `smoke` (fast, every run, blocks the release), `shell` (every Shell flow), `rtl`, `offline`, `a11y` (the accessibility skill's 200 % text pass: the runner leaves these flows out of the flows step and runs them in its large-text step with `-e LANG=en` and `-e LANG=fa` on the phone and the iPad; an a11y flow lives in `flows/a11y/` and may read `${LANG}`), `<game-id>` (every game flow), `quarantine` (excluded from runs, see below), `screenshots` (the matrix only).
- No `env:` block for `APP_ID`, `APP_SCHEME`, `LANG` or `THEME`: in Maestro 2.10.0 the flow's `env:` value wins over `-e`.
- The first step is `launchApp` with `clearState: true` (add `clearKeychain: true` for first-launch flows), so every run starts from the same state.

## Selecting elements: testIDs only

- `tapOn: { id: 'home.play-button' }`, `assertVisible: { id: 'result.screen' }`. Flows then run unchanged in en, de, fa and ckb.
- A testID is `<scope>.<element>[.<part-or-key>]`, every segment `[a-z0-9]+(-[a-z0-9]+)*`. The scope is the route in kebab-case (`language-choice`, `settings-language`), an overlay (`pause`, `result`) or a dialog (`restart-dialog`). Every screen root is `<screen>.screen`. Repeated items append a stable data key, never an index: `language-choice.language-row.en`, `levels.level-tile.12`. A flow selects only ids Maestro can list: a part inside an accessible element (the map's `parent`, such as `levels.level-tile.1.stars-3` or `.label`) or a decorative part hidden from VoiceOver (`a11yHidden`) is crop-only, and `check-flows` fails it (`unreachable-testid`); select the element named in its `coveredBy` and match its label with `text:` instead.
- Every id a flow uses must exist in the testID contract: `assets/screen-testids.json` (every element of every Toybox screen, plus the chosen-but-not-drawn ids in `notDrawn`), `assets/e2e-testids.json` (`debug.network-attempts`, `game.board-layout`), or the game's own `apps/<game-id>/e2e/testids.json`. `check-flows.mjs` fails an unknown id before a simulator ever times out on it. Add a new id to the component and the contract in the same change.
- `text:` next to `id:` is a filter on the element's text (a regex), which is fine: `assertVisible: { id: 'debug.network-attempts', text: '0' }`, `text: '.*1.*'`.
- Ids whose last part is a count take any count: the map draws `result.stars-3`, and `result.stars-1` or `levels.level-tile.12.stars-2` are the same elements with another count (the tile's stars stay crop-only). Assert the star count the chosen line earns, never a hopeful 3: a game flow's `result.stars-<n>` must be listed in `apps/<game-id>/e2e/testids.json` with why (`check-flows` rule `win-stars`); `print-level-line.ts` prints the count.
- `id:` is a regular expression over the whole testID. A pattern (such as `debug-setup.yaml`'s screen-root wait) must match at least one id of the contract; `check-flows` fails one that matches none or does not compile.
- Text-only selectors are allowed only for OS-owned UI, with a comment above that says so:

  ```yaml
  # system-ui: iOS may ask "Open in <app>?" for the link; 'Open' is Apple's button, not app text.
  - runFlow:
      when:
        visible: 'Open'
      commands:
        - tapOn: 'Open'
  ```

## Setting up state: the debug-setup sub-flow

State is set only through the test build's debug deep link, never by tapping through menus (slow, flaky, and it couples every flow to every screen). The one tap a flow makes on its way is the key under test: the journey's own key on the screen the link opened, such as S9's Play key in the daily flow, Home's endless card, the Result screen's continue key, or the level-2 tile that proves the unlock. The state around that key still comes from the link:

```yaml
- launchApp:
    clearState: true
- runFlow:
    file: ../../subflows/debug-setup.yaml
    env:
      QUERY: 'lang=en&theme=light&seed=42&date=2026-09-26&ads=off&offline=1&firstRun=0&reduceMotion=1'
      WAIT_FOR: 'home.screen'
```

`debug-setup.yaml` first waits for a screen root (any `<scope>.screen` but the startup splash, or the roots of the Pause dialog and the S14 dialog cards, which hide the screen under them from Maestro), then opens `${APP_SCHEME}://debug/setup?${QUERY}`, accepts the iOS "Open" prompt when it appears, and waits up to 15 s for the id in `WAIT_FOR`. The parameters and their values are in `debug-deep-link.md`; `check-flows.mjs` rejects an unknown parameter or value. It also follows each `runFlow` into the sub-flows it reaches and checks the ids and queries they build from the values passed in (`${SCREEN}.screen` with `SCREEN: game-start` would be `game-start.screen`, an id no screen renders).

One link per setup is enough, also right after `launchApp: { clearState: true }`:

- **The first screen first.** Right after the launch the wait sees the app's first screen (`language-choice.screen`, `tutorial.screen`, `home.screen`, or `not-built.screen` in a partial Shell; `pause.dialog` when a killed run reopens), so the app's JavaScript is running. The app also listens for links from its first moment (`createDebugParts`) and keeps a link that arrives before its navigator is ready until it is; a link sent while nothing listened would be lost (round 2: every query failed after `clearState`).
- **Save changes, then the screen.** The app writes the link's save changes first. When `firstRun=0` ends a first run (or `firstRun=1` starts one) the navigator changes group, and the app opens `screen=` on the next navigation state, once the new group is mounted: `firstRun=0&level=1&screen=game` opens Game in one link.
- **`action=` in a link of its own**, once its run is on screen: `action=win-level` / `lose-level` ends the active run, whatever its kind (a level, today's daily or an endless run), through the game host (`GameHost.debugControls().playTo`), which swaps the run's state for the game's example win or loss and runs the one run-end path (stars, the daily result and streak, the endless best, statistics and ad history saved before Result shows). A loss that still has its continue shows the lose screen with the offer and is recorded only when the continue is used or declined. Without a run on screen the link is an error (logged; S15 opens). `firstRun` and `action` in one link, or `action` after a direction reload, are refused: send two links.
- **`boardLayout=1` before reading the board probes.** `game.board-layout` and `game.moves-label` exist only while it is on; put it in the setup `QUERY`.

## The shared sub-flows

| Sub-flow | Does | Env |
|---|---|---|
| `debug-setup.yaml` | waits for a screen or dialog root, applies a debug query (accepting iOS's "Open in <app>?" prompt), waits for an id (a shared file, synced from the library; do not edit here). Tools open debug links through it too, never with `simctl openurl`, whose prompt nobody accepts | `QUERY`, `WAIT_FOR` |
| `assert-no-network.yaml` | opens the debug screen, scrolls down to `debug.network-attempts` (drawn under S15's fourteen rows, below the fold on a phone) and asserts it shows `0` | none |
| `shoot-screen.yaml` | opens one screen (`screen=${SCREEN}`), waits for the id in `ROOT`, waits for animations to end, takes a screenshot named `${SCREEN}` | `SCREEN`, `ROOT` (`home.screen`; the game states `game-start` and `game-middle` show `game.screen`, `result-win` and `result-lose` show `result.screen`) |

## The Shell's flows

Templates in `templates/packages/shell/e2e/flows/` (all pass `maestro check-syntax`). Copy them at Shell step 10, once every screen they reach is built: in a partial Shell (`shell-slice.json`) a flow that reaches a screen outside the slice cannot run, and `check-flows` prints `SKIP <flow> [slice] <S-id> not in shell-slice.json` for it instead of checking it (flow 01 reaches S2 and the tutorial, 02 reaches S9 and S10, 03 reaches S8 and S11a).

- `smoke/01-first-launch.yaml`: S1 → S2 → the tutorial. Clears state and keychain, picks English, continues, waits for `tutorial.screen`, asserts the skip button is not offered on the first tutorial, screenshots, asserts no network.
- `journeys/02-core-journey-offline.yaml` (spec 15 item 2, offline via `offline=1`): Home without a banner ad → Play → win through `action=win-level` → Next → `killApp` and relaunch → the Pause overlay offers Resume (the save survived process death, spec 15 item 6) → Home → Daily → Stats → back, then no network. Home's daily card has two accessible parts (lead decision L7): the card body `home.daily-card` opens S9 Daily challenge (also once today is done), and the Play key `home.daily-card.play-button`, a separate button above it, starts today's run. The journey taps `home.daily-card` and waits for `daily.screen`; the title, date, streak and icon are crop-only parts covered by the card (select the card, never them).
- `rtl/03-language-switch.yaml` (S11a): Settings → Language → Persian → "Restart to apply" → Home again after the reload → the seeded 3-star level 1 still shows 3 stars, screenshot in Persian.

## A game's flows and board taps

A Skia canvas has no accessibility nodes, so the board is tapped by coordinates. With `boardLayout=1` the test build renders `game.board-layout`, a small Text holding `JSON.stringify({ x, y, layout })`: `x`, `y` are the canvas's top-left corner in window points and `layout` is the game's `BoardLayout` (regions in canvas points, unmirrored, plus `isMirrored`). The flow reads it and computes cell centres:

```yaml
- copyTextFrom:
    id: 'game.board-layout'
- evalScript: ${output.board = JSON.parse(maestro.copiedText)}
- evalScript: ${output.grid = output.board.layout.regions.find((region) => region.id === 'board')}
# Cell centre = canvas origin + region origin + (col + 0.5) * cell (this board does not mirror).
- evalScript: ${output.cell20 = Math.round(output.board.x + output.grid.x + 2.5 * output.grid.cell) + ',' + Math.round(output.board.y + output.grid.y + 0.5 * output.grid.cell)}
- tapOn:
    point: ${output.cell20}
```

For a mirrored board (`isMirrored` true) the horizontal centre is `x + layout.width - region.x - (col + 0.5) * region.cell`. A tap-then-tap board (Line Siege: a tray slot, then a board cell) makes each move with two taps, select first.

Maestro reads each `evalScript` line as YAML first: `: ` (colon and space) inside it starts a mapping and `maestro check-syntax` fails ("Parsing Failed"). No ternary `cond ? a : b` there; use arithmetic such as `Number(output.tray.cols > 1)`, or quote the whole scalar.

Verified on Maestro 2.10.0 with the real Shell (Line Siege, iPhone 17 Pro Max, iOS 26.5): reading the JSON from `game.board-layout`, `regions.find` with an arrow function, the centre maths, `tapOn: { point }` reaching the Skia board in a Release build, twelve tap-then-tap moves, a kill and relaunch onto Pause with the move kept.

## The level-1 flow: one move, a kill, a win, then the stars in Levels

`templates/apps/__GAME_ID__/e2e/flows/smoke/10-level-1.yaml` is every game's smoke flow. Copy it to `apps/<game-id>/e2e/flows/smoke/10-level-1.yaml` and fill the placeholders from `print-level-line.ts` (next section):

1. `launchApp` with `clearState`, then one setup link: `lang=en&theme=light&seed=42&level=1&ads=off&firstRun=0&reduceMotion=1&boardLayout=1&screen=game`, `WAIT_FOR: game.board-layout`.
2. The first move by taps (`__FROM_REGION_ID__`/`__FROM_COL__`/`__FROM_ROW__` is the select tap of a tap-then-tap game; a one-tap game deletes the FROM taps and keeps TO), then `game.moves-label` shows `1`.
3. `killApp`, `launchApp: { stopApp: false }`: the saved run reopens on Pause; Resume; `game.moves-label` still shows `1`.
4. `action=win-level` in its own link, `WAIT_FOR: result.screen`: the game host ends the level exactly like a real win.
5. `result.stars-__WIN_STARS__`: the stars the game's `testing.examples.win()` earns on level 1 (Line Siege: score 180 against 0 / 150 / 180, so 3). List `result.stars-<n>` with that reason in `apps/<game-id>/e2e/testids.json`.
6. A screenshot, then the stars reach progress: `screen=levels`, `levels.level-tile.1` with `text: '.*[^0-9]__WIN_STARS__ .*'` (the tile's VoiceOver label, "Level 1: 3 stars": the stars are crop-only parts inside the tile, and the count followed by a space never matches the level's own number), then a tap on `levels.level-tile.2` (the tile under test) opens `game.screen` with `game.mode-label` showing level 2, and `levels.locked-toast` never shows. `check-flows` rule `progress-after-win` asks for these steps in a game smoke flow that wins a level.
7. `assert-no-network.yaml`.

Since the Levels steps, the flow reaches S8: in a partial Shell without S8 in `shell-slice.json`, `check-flows` prints `SKIP ... [slice] S8 not in shell-slice.json` for it, so a pilot slice lists S8 (Levels) with Home, Game, Pause, Result and Debug.

`action=win-level` needs the game host's debug controls (game-host-integration: `GameHost.debugControls()`, passed to `createDebugParts` as `game`). Where a repo does not have them yet, or to prove a real line end to end, play the bot's line instead: after step 3 write one tap pair per move of `print-level-line.ts`'s bot line (the same `evalScript` maths, one region at a time), assert `game.moves-label` after each move, then wait for `result.screen` and assert the stars that line earns (Line Siege level 1: 12 moves, score 140, `result.stars-1`). The line is deterministic: the level's seed and playBot's seed rule give the same moves in the app and in Node.

## A game's mode flows: daily, continue, endless

`check-flows` rule `mode-flows` reads `apps/<game-id>/game.config.ts` and asks for one flow per mode the game has. Copy each template from `templates/apps/__GAME_ID__/e2e/flows/journeys/` and fill `__GAME_ID__` and `__GAME_NAME__`; every id they use is in the screen map (`assets/e2e-testids.json` lists them under `gameFlowIds` with the step that needs each):

| Game fact | Template | What it proves |
|---|---|---|
| `modes.daily` | `11-daily.yaml` | `date=2026-09-26&firstRun=0&screen=daily`, tap `daily.play-button` (S9's own key), `action=win-level`, the daily result (`result.daily-title`, `result.streak-sticker`, `result.come-back-note`), then a kill and `date=2026-09-27&screen=daily`: `daily.current-streak-card.value` reads 1 ("1 day": `text: '[^0-9]*1[^0-9]*'`) and today is not done (`daily.play-button` shown, `daily.replay-button` not) |
| `isContinueAllowed` | `12-continue-premium.yaml` | `premium=1&level=1&firstRun=0&screen=game`, `action=lose-level`, the Premium owner's `result.continue-premium-button` (no `result.continue-ad-button`), then `game.screen` shows level 1 playing again |
| `modes.endless` | `13-endless.yaml` | `seed=42&premium=1&firstRun=0&screen=home`, tap `home.endless-card`, `action=lose-level`; the first loss offers the one continue, which the Premium key takes, and a second `action=lose-level` ends the run: `result.endless-title` and `result.score-card.new-best`, then `result.home-button` and Home's `home.endless-card` label carries a best above 0 (`text: '.*[1-9].*'`); a game without a continue deletes the continue steps and `premium=1` |

E2E builds run with ads off, so the rewarded continue (`result.continue-ad-button`, "Watch an ad to continue") never shows in these flows: admob-ads' simulator smoke test in an `ADS_MODE=test` build covers it (lose level 1, watch the test ad, the run resumes after the reward). For the same reason no E2E flow ever meets Google's consent form or Apple's tracking prompt.

Verified on the simulator (Line Siege, iOS 26.5): all three flows passed. An endless loss that still has its continue shows the lose screen ("Not this time", Try again, Levels) with the offer, not the endless result: the host records the run only once the continue is used or declined, which is why the endless flow takes the Premium continue first.

## Taps and stars from the game: print-level-line

```sh
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON packages/tooling/src/e2e/print-level-line.ts --app line-siege --level 1
```

`templates/packages/tooling/src/e2e/print-level-line.ts` (with the pure `level-line.ts` and its test) loads the game's pure modules (`rules/<id>-engine.ts`, `testing/<id>-testing.ts`, `board/<id>-board.ts`, the committed `levels/pack-<n>.json`) and prints:

- the first listed move that taps can make, as tap targets (`tray col 0 row 0, then board col 0 row 0`): each move's targets come from the board's `targetsOfMove` and are checked through the engine's own `intentToMove` (a select-region tap first for tap-then-tap games);
- `action=win-level earns <n> star(s)`: the level's star rule applied to `testing.examples.win()` (after the flow's one move, which is what a par rule counts);
- the bot's whole line with its taps (`testing.bot` from the level's seed, bot RNG `seedRng(seed ^ 0x5bd1e995)` as `playBot` does) and how it ends.

Targets are region cells of the portrait phone layout (the E2E phone). A board without `targetsOfMove`, or a swipe or drag game, prints the moves without taps: write those gestures by hand. Line Siege level 1 prints exactly the 12-move line round 2 played on the simulator.

## Ending smoke flows: no network

Every flow tagged `smoke` ends with:

```yaml
- runFlow: ../../subflows/assert-no-network.yaml
```

It asserts the test build's JS network guard counted zero `fetch`, `XMLHttpRequest` and `WebSocket` attempts (spec N3). Native traffic is caught separately by the runner's socket sampler (`runner-and-network.md`).

## Waiting without sleeping

- Wait for an id: `extendedWaitUntil: { visible: { id: 'home.screen' }, timeout: 15000 }` (15-20 s after a relaunch or a direction reload).
- Before a screenshot: `waitForAnimationToEnd: { timeout: 5000 }`, and run with `reduceMotion=1`.
- Never a fixed sleep: it is slow when the app is fast and flaky when the simulator is slow.

## Flaky flows and quarantine

A flaky flow passed and failed on the same commit. It is a bug in the flow or the app.

1. Rerun the failing flow alone: `tools/maestro/bin/maestro --device <udid> --driver-host-port <port> test <flow> -e APP_ID=<id> -e APP_SCHEME=<scheme>` (with the three `MAESTRO_*` variables set; `<udid>` is this session's own `e07-*` simulator and `<port>` a free port of this run, never the default 7001, which another session's driver may hold).
2. If it passes alone, it is flaky: fix the wait (`extendedWaitUntil` on an id, never a sleep), the setup (the debug link) or the app. `retry:` never wraps app assertions.
3. If the fix needs more than this session, add `quarantine` to the flow's tags and a comment `# quarantine <YYYY-MM-DD>: <reason>`, report it in the evidence, and fix it within 7 days. The runner excludes `quarantine`; `check-flows.mjs` fails a quarantine older than 7 days.
4. A `smoke` flow can never be quarantined: it blocks the release until fixed.
5. When a simulator's state looks wrong: `xcrun simctl erase <udid>` on the dedicated simulator, then rerun.

## What a flow should not prove

A rule proven by unit tests and properties does not need a flow; the flow proves the wiring (navigation, persistence across a kill, direction reload, offline behaviour). Translations are proven by the catalog checks, layout and mirroring by the screenshot matrix.
