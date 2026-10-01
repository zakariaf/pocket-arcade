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
- [ ] The owner approved the app name (step G1). The bundle id is not a question: it is always `io.applander.<game id without hyphens>` on iOS and Android (`io.applander.flocktilt`), and Premium is `<bundle id>.premium` (owner decision O4); the scaffold writes both.
- [ ] If the game is one of the three designed in the copy deck (line-siege, flock-tilt, scrap-shove), its texts, pack names and modes come from the deck; otherwise the texts are written with the i18n workflow and added to the deck at the next design pass.

## Step 0: scaffold the app

```sh
node ${CLAUDE_SKILL_DIR}/scripts/scaffold-game.mjs --app <game-id> --name "<Name>" --hints none --continue once            # plan
node ${CLAUDE_SKILL_DIR}/scripts/scaffold-game.mjs --app <game-id> --name "<Name>" --hints none --continue once --write    # write
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
| 11 | Before the Shell frames: add the app's entry to `parity/game-facts.json` (`designGame`, `hasMusic`, `winLine`, `hasHints`) and copy the parity pin test `apps/<game-id>/src/parity-game-facts.test.ts`, both from the toybox-visual-parity templates. The facts pick each frame's Toybox reference: `hasHints` is `true` exactly when the game has a solver hint (`rules.hints.kind` is `'solver'`, so `game.config.ts` gives `hints.freePerDay` 1; 0 means `false`, which hides the S5 hint key), `hasMusic` is `true` when the sound bank has a music sound, `winLine` is `"moves"` for par-rated levels and `"score"` for score-rated ones | toybox-visual-parity (hand-off) | `check-game-app.mjs` rule `parity-game-facts`; the pin test passes |
| 12 | The game's own E2E flows (numbered 10 and up, one real board tap) and screenshot baselines; every screen matches its Toybox design screenshot | e2e-maestro, toybox-visual-parity | flows green, parity compare |
| 13 | Audits: `npm run audit:network`, then after a prebuild `npm run audit:privacy` | privacy-and-network-audit | both pass |

## Proving the game is complete

```sh
node ${CLAUDE_SKILL_DIR}/scripts/check-game-app.mjs . --app <game-id>        # --stage complete is the default
npm run verify
```

`--stage complete` fails until every module part exists (each failure names the skill that builds it), `src/index.ts` assembles all eleven members with `identity.winTitleId` `'<game-id>.win-title'` and `identity.taglineId` `'<game-id>.tagline'`, the engine declares a valid `panMode`, `index.ts` is the 3-line entry, every `<game-id>.*` key the code uses is in all four catalogs, `game.config.ts` agrees with the levels and the continue rule, the bundle id and Premium id are the fixed `io.applander` ids, no scaffold placeholder is left (rule `owner-placeholder`: the AdMob app and unit ids until G5, `example.com` and `support@example.com` until G3), the game's `parity/game-facts.json` entry agrees with `game.config.ts` (rule `parity-game-facts`), the board goldens, bot sims, E2E flows and the parity pin test exist, and the repo has no `shell-slice.json` (a partial Shell never ships; the rule `shell-slice`). While G3 or G5 is open, the only failures left are the `owner-placeholder` lines, by design; list them as open owner steps. Then:

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
| G1 | Approves the app name (the bundle id is fixed: `io.applander.<game id without hyphens>`) | the Latin name in all four languages |
| G2 | Creates the App Store Connect app record with the fixed bundle id (iOS, the name, primary language, SKU = the game id; about 2 minutes, no API for it) | `appStoreId: null` |
| G3 | Answers the App Privacy questionnaire and gives the privacy link (policy host and path, support address) | `example.com` and `support@example.com`; `--stage complete` fails on them (`owner-placeholder`) and nothing ships |
| G4 / P1 | Nothing to decide: Premium is the EUR 1.99 App Store price point with Family Sharing off, as for every game (owner decisions O2 and O3); the agent creates the product `<bundle id>.premium` and the owner checks it | purchases untestable |
| G5, A2-A4 | AdMob app, three ad units, consent message, blocking controls; real IDs go into `game.config.ts`; after release, link the AdMob app to the store listing and publish `app-ads.txt` | the documented placeholder IDs; test builds use Google's test IDs anyway; `--stage complete` and the ship gates fail on them (`owner-placeholder`) |
| G6 | TestFlight play-test, including the purchase test (the owner does it personally; it never blocks a gate) | listed under "Owner steps (not blocking)" in every report |
| G7 | Native-speaker review of fa and ckb (the owner does it personally; it never blocks a gate) | the drafted texts ship; listed under "Owner steps (not blocking)" |
| G8 | Approves the store listing: texts, screenshots, age-rating answers (`game.config.ts` `store`) | no store submission |

## Release

`npm run release:ios -- --app <game-id> --variant test` once the owner's blocking steps (G1 to G5) are done, then the store build (ios-release-testflight). The play-test, the native review of the fa and ckb texts and listening to the sound previews are the owner's own steps: every report lists them under "Owner steps (not blocking)", and no gate waits for them. Uploads, App Store Connect changes and pushes are outward-facing: ask first.
