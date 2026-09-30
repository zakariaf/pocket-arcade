# The new-game checklist

Everything between "the owner picked the next game" and "the game ships", in order, with the skill that does each step and the check that proves it. A game is one Expo app in `apps/<game-id>/` on top of the one Shell (spec N4, N5): it provides the `GameModule` members and nothing else.

## Contents

- Before code (owner and agent together)
- Step 0: scaffold the app
- The build order
- Proving the game is complete
- The owner's per-game steps
- Release

## Before code (owner and agent together)

- [ ] The owner picked the game (spec section 13) and approved its design notes: modes (daily on by default, endless optional), pack layout (default 3 x 30), star rule (par for puzzles, score thresholds otherwise), difficulty bands for the bot sims, undo, hints (`none`, or `solver` when a solver proves the next move) and continue (`once` with its rule, or `none`), and the lose reasons (one `<id>.lose.<reason>` key each).
- [ ] The owner answered the age-rating question for cartoon or fantasy violence (step G1; `NONE` unless the game hits monsters or characters).
- [ ] The owner approved the app name and bundle id (step G1). The bundle id matches `^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$` and is the same on iOS and Android.
- [ ] If the game is one of the three designed in the copy deck (line-siege, flock-tilt, scrap-shove), its texts, pack names and modes come from the deck; otherwise the texts are written with the i18n workflow and added to the deck at the next design pass.

## Step 0: scaffold the app

```sh
node ${CLAUDE_SKILL_DIR}/scripts/scaffold-game.mjs --app <game-id> --name "<Name>" --bundle-id <approved.id> --hints none --continue once            # plan
node ${CLAUDE_SKILL_DIR}/scripts/scaffold-game.mjs --app <game-id> --name "<Name>" --bundle-id <approved.id> --hints none --continue once --write    # write
npm install                                            # links @e07/<game-id>, updates package-lock.json
node ${CLAUDE_SKILL_DIR}/scripts/check-game-app.mjs . --app <game-id> --stage scaffold
(cd apps/<game-id> && APP_VARIANT=test  EXPO_PUBLIC_APP_VARIANT=test  ADS_MODE=test npx expo config --json)
(cd apps/<game-id> && APP_VARIANT=test  EXPO_PUBLIC_APP_VARIANT=test  ADS_MODE=off  npx expo config --json)
(cd apps/<game-id> && APP_VARIANT=store EXPO_PUBLIC_APP_VARIANT=store ADS_MODE=off  npx expo config --json)
npm run -s check:fast
```

Pass the design notes' answers: `--hints none|solver`, `--continue once|none`, `--lose-reason <slug>` for a game outside the copy deck (default `out-of-moves`), `--endless` when the levels spec has an endless run, `--no-daily` without a daily, and `--violence-rating INFREQUENT_OR_MILD` when the owner said so. The pilot `line-siege` already exists after the monorepo bootstrap; never scaffold it again with `--write` (use `--add-missing` if a file is missing).

`npm run new-game -- --app <game-id> ...` runs the same generator once `packages/tooling/src/scaffold/new-game.ts` exists (copy `templates/tooling/new-game.ts`; `check-game-app.mjs` reports `new-game-script` while it is missing).

Nothing is added to `quality-gates.json`: its `apps/*/tsconfig.json` key and the ESLint globs cover every app. Commit the skeleton (`feat(<game-id>): scaffold the app`).

## The build order

Each layer is tested before anything depends on it (test-first throughout, one behaviour per commit):

| # | Step | Skill | Proof |
|---|---|---|---|
| 1 | Classify the game (turn-based, simulate-then-replay, real-time), input mode and input policy, and its pan mode (`'none'`, `'swipe'`, `'drag'` or `'aim'`; real-time games `'none'` plus the stick): it becomes `engine.panMode` in the GameModule contract, never a `game.config.ts` field | game-rules-engine, board-gestures-and-input | written in the design notes |
| 2 | State, moves, events; `create`, `listMoves`, `applyMove`, `outcome` with properties and a golden | game-rules-engine | `check-rules-engine.mjs . --game <id>` |
| 3 | Bot and sims: winnability, difficulty curve, termination; they pass before any pack is generated | game-balance-and-bots | `npm run test:sim` |
| 4 | Solver (or the witness for a game that draws its future from the RNG), par, level plan, generated packs (never copied), daily difficulty and salt, data goldens; `modes.endless` in `game.config.ts` equals the levels spec's endless kind. A later tuning change regenerates the packs with a `Gate-Change:` trailer | level-generation-and-solvers | `check-levels.mjs . --game <id>` |
| 5 | Persistence (`parseState`, `parseMove`, round trip, save policy); real-time save points | game-rules-engine, realtime-game-loop | rules check, save tests |
| 6 | Board: view, timeline, palette tokens (`board-palettes.json` with its `board-contrast.json`), paths, layout, draw, draw-call budget, pixel goldens at three sizes; `intentToMove`, gestures, 44 pt targets | board-rendering-skia, board-gestures-and-input, accessibility | their checks, then `check-contrast.mjs .` (accessibility), `npm run test:golden` |
| 7 | UI palette (`src/theme/palette.ts`) and fonts | toybox-design-system | `check-design-system.mjs` |
| 8 | Teaching (tutorial script, 3 to 5 how-to-play pages), 2 to 4 statistics counters, all four catalogs with `<game-id>.` keys, including `<game-id>.name`, the S7 win title `<game-id>.win-title` and the tagline `<game-id>.tagline` | game-host-integration, game-rules-engine, i18n-strings-and-catalogs | `npm run i18n:verify` |
| 9 | `LOGO_ART`, `GAME_ART` (`src/art/game-art.ts`: palettes, `logo: LOGO_ART`, credits), the app icon and splash PNGs (`render-art.ts --app <id> --check`), sound bank and recipe tests | code-drawn-art-and-icons, game-audio-and-haptics | their checks |
| 10 | Assemble `src/index.ts` as `ShellGameModule<Types>` (identity `{ id, nameId, winTitleId, taglineId }`, `engine` with `panMode`), the 3-line `index.ts`, the contract test | game-host-integration | its check script and the contract test |
| 11 | The game's own E2E flows (numbered 10 and up, one real board tap) and screenshot baselines; every screen matches its Toybox design screenshot | e2e-maestro, toybox-visual-parity | flows green, parity compare |
| 12 | Audits: `npm run audit:network`, then after a prebuild `npm run audit:privacy` | privacy-and-network-audit | both pass |

## Proving the game is complete

```sh
node ${CLAUDE_SKILL_DIR}/scripts/check-game-app.mjs . --app <game-id>        # --stage complete is the default
npm run verify
```

`--stage complete` fails until every module part exists (each failure names the skill that builds it), `src/index.ts` assembles all eleven members with `identity.winTitleId` `'<game-id>.win-title'` and `identity.taglineId` `'<game-id>.tagline'`, the engine declares a valid `panMode`, `index.ts` is the 3-line entry, every `<game-id>.*` key the code uses is in all four catalogs, `game.config.ts` agrees with the levels and the continue rule, the bundle id is no longer the `com.example.` placeholder, the board goldens, bot sims and E2E flows exist, and the repo has no `shell-slice.json` (a partial Shell never ships; the rule `shell-slice`). Then:

- [ ] Contract tests pass; coverage of `apps/<game-id>/src/rules` is at least 95/95/95/90; Stryker on the rules at least 75 % with survivors explained.
- [ ] Sims show a winnable game and a difficulty curve inside the approved bands; every shipped level is proven solvable (spec 15 item 7).
- [ ] `npm run i18n:verify` passes; the fa and ckb texts are marked for the native-speaker review.
- [ ] The icons were looked at in 1024 and 256 px.
- [ ] The game's E2E flows and the Shell's flows pass with this game; screenshot baselines created with `--update`, every PNG opened, committed with `Gate-Change:`.
- [ ] `npm run audit:network` and, after a prebuild, `npm run audit:privacy` pass.

## The owner's per-game steps

Ask for them in one message, each with the step id, the one action, and the default that applies meanwhile (see `examples/owner-request.md`):

| Step | What the owner does | Until then |
|---|---|---|
| G1 | Approves app name and bundle id | scaffold with the `com.example.` placeholder; `--stage complete` fails on it |
| G2 | Creates the App Store Connect app record (iOS, the name, primary language, the bundle id, SKU = the game id; about 2 minutes, no API for it) | `appStoreId: null` |
| G3 | Answers the App Privacy questionnaire | nothing ships |
| G4 / P1 | Premium price point and Family Sharing; then the agent creates the product | purchases untestable |
| G5, A2-A4 | AdMob app, three ad units, consent message, blocking controls; real IDs go into `game.config.ts`; after release, link the AdMob app to the store listing and publish `app-ads.txt` | the documented placeholder IDs; test builds use Google's test IDs anyway |
| G6 | TestFlight play-test, including the purchase test | no store build |
| G7 | Native-speaker review of fa and ckb | texts marked as machine-written |
| G8 | Approves the store listing: texts, screenshots, age-rating answers (`game.config.ts` `store`) | no store submission |

## Release

`npm run release:ios -- --app <game-id> --variant test` once the owner's steps are done, the owner's play-test, then the store build (ios-release-testflight). Uploads, App Store Connect changes and pushes are outward-facing: ask first.
