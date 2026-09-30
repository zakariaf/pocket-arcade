---
name: new-game-scaffold
description: Creates a new game app in apps/ - scaffold script, game.config.ts, lockstep package.json, metro cache key, fonts, catalogs, owner IDs, the new-game checklist, a completeness check. Use when adding or starting a new game, or checking a game is complete. Not for the monorepo (monorepo-bootstrap).
---

# New game scaffold

Turns "the owner picked the next game" into `apps/<game-id>/`: a verified Expo SDK 57 app skeleton on the one Shell, written by a script from templates, with the configuration, fonts and catalogs every game needs; then walks the game through the build order and proves, with a second script, that the finished app is complete.

## Rules that must hold

1. **Create the app with `scaffold-game.mjs`, never by copying another game's folder.** Why: a copied app carries the other game's ids, catalogs and dependency drift; the script fills every id form and refuses to overwrite.
2. **One game = one app = one `apps/<game-id>/`,** and the game id (kebab-case, from the catalogue) is the folder, the package `@e07/<game-id>`, `GameConfig.id`, `identity.id`, the save's `gameId` and the catalog key prefix. Why: spec N4; the id is inside every save and never changes after release.
3. **Every per-game store and runtime setting lives in `game.config.ts`** (spec 11), read only by `app.config.ts`; app code never imports it, and nothing in it becomes `null` in `expo.extra`. Its settings follow the game's rules, never a default: `hints.freePerDay` from `--hints none|solver` (0 or 1), `isContinueAllowed` from `--continue once|none`, `modes.endless` equal to the levels spec's endless kind, and the violence answer from `--violence-rating` (default `NONE`; the owner confirms it at step G1). What the game's code decides (the board's `panMode`, the win title key, the logo) lives in the GameModule instead. Why: one file per game; a config that promises a hint or a continue the rules lack breaks the contract; `null` arrived as `{}` on the device and broke a strict parser.
4. **`app.config.ts` is the one statement `export default withShell(gameConfig, process.env);`** with `.ts` import extensions. Why: every native setting comes from the Shell's composer and plugins (continuous native generation); Node's type stripping needs the extensions.
5. **The app's dependencies are exactly the other apps' dependencies** (same packages, same versions; the scaffold copies the newest app's list, never the versions table). Why: native modules autolink per app and `expo install --check` sees only an app's own list; a drift crashes or builds a different app, and knip fails on a package nothing imports.
6. **`metro.config.js` keys the cache on `EXPO_PUBLIC_APP_VARIANT`.** Why: without it a store build reused test-build transforms and shipped the debug menu (verified).
7. **Bundle the five Toybox fonts and three OFL texts byte for byte, and keep four flat, sorted catalogs with identical keys, every key starting with `<game-id>.`, one `<game-id>.lose.<reason>` key per way of losing, every key the copied templates use, and, for a game in the copy deck, the deck's words.** Why: the look, the licence list and RTL text depend on the exact files; a missing key breaks a translated screen and the contract test; the deck is the design's copy and changes (the Line Siege march text did on 2026-09-30).
8. **The bundle id, app record, Premium product and AdMob ids are the owner's** (steps G1-G5); the scaffold writes documented placeholders; `--stage complete` fails on the `com.example.` bundle id, and the AdMob ids and privacy link must be the owner's before the first store build. Why: they are outward-facing, account-bound decisions.
9. **Never overwrite an existing app.** `--write` creates a new app and refuses on any conflict; an app that exists (the bootstrap's pilot) is completed with `--add-missing`, which writes only absent files. Why: the pilot and a grown app hold the owner's decisions.
10. **Build the game in the documented order and finish with `check-game-app.mjs . --stage complete`.** Why: each layer is tested before anything depends on it, and the owner never reads code; the check proves nothing is missing.

## Workflow

1. **Before code.** Read [references/new-game-checklist.md](references/new-game-checklist.md) ("Before code"). Confirm with the owner: the game, modes, pack layout, star rule, difficulty bands, the input (taps, swipes, drags or aim: the engine's `panMode`), and the app name and bundle id (G1). Send the per-game requests in one message shaped like [examples/owner-request.md](examples/owner-request.md); continue with placeholders meanwhile.
2. **Plan the app.** Read [references/ids-and-names.md](references/ids-and-names.md). Once per repo: the monorepo bootstrap already writes `packages/tooling/src/scaffold/new-game.ts` (the root `new-game` npm script runs it); only if it is missing (an older repo), copy `templates/tooling/new-game.ts` there; it forwards `npm run new-game -- <args>` to this skill's generator. From the repo root run `node ${CLAUDE_SKILL_DIR}/scripts/scaffold-game.mjs --app <game-id> --name "<Name>" --bundle-id <approved.id> --hints none|solver --continue once|none` (add `--lose-reason <slug>`, `--endless`, `--no-daily`, `--violence-rating`, `--name-fa`, `--name-ckb` as agreed; a game in the copy deck takes its names, texts, lose slug and modes from it). Read the plan (compare [examples/flock-tilt/scaffold-plan.txt](examples/flock-tilt/scaffold-plan.txt)); a `deps-lockstep` failure is fixed first with the dependency-management skill, a `conflict` by hand. The pilot `line-siege` already exists after the bootstrap: never `--write` it; `--add-missing` completes it if a file is missing.
3. **Write it:** the same command with `--write`, then `npm install` (links `@e07/<game-id>`, updates `package-lock.json`). Note the printed daily-salt suggestion for the levels step.
4. **Check the skeleton.** Read [references/app-files.md](references/app-files.md) if anything fails. Run `node ${CLAUDE_SKILL_DIR}/scripts/check-game-app.mjs . --app <game-id> --stage scaffold` until `RESULT: PASS`, then `npx expo config --json` in `apps/<game-id>` for test/test, test/off and store/off, `npx tsc --noEmit -p apps/<game-id>`, `npx eslint --max-warnings 0 apps/<game-id>` and `npm run -s check:fast`. Commit `feat(<game-id>): scaffold the app`.
5. **Build the game in order** (the table in the checklist): rules (game-rules-engine), bots and sims (game-balance-and-bots), levels (level-generation-and-solvers), persistence, board and input (board-rendering-skia, board-gestures-and-input), palette (toybox-design-system), teaching, counters and texts, art and sounds, then the assembly and the 3-line `index.ts` (game-host-integration), E2E flows and screenshot parity, audits. Each step test-first, each with its own skill's check.
6. **Prove it complete:** `node ${CLAUDE_SKILL_DIR}/scripts/check-game-app.mjs . --app <game-id>` (stage complete; it also fails while `shell-slice.json` exists, because a partial Shell never ships). Each `module-part-missing` or `evidence-missing` line names the skill that builds the part; fix and rerun until it prints `RESULT: PASS`, then `npm run verify`.
7. **Report and hand over:** outcome in players' words, the owner steps still open (G1-G8), what could not be verified (sound, haptics, 120 Hz, purchases need a device or TestFlight). Release only after the owner's steps and play-test (ios-release-testflight); uploads and pushes are outward-facing, ask first.

## Definition of done

- [ ] `apps/<game-id>/` was written by `scaffold-game.mjs` with the game's `--hints` and `--continue`, and `check-game-app.mjs . --app <game-id> --stage scaffold` passed before any game code.
- [ ] `npx expo config --json` works in the app for test/test, test/off and store/off; `npx tsc --noEmit -p apps/<game-id>` and `npx eslint --max-warnings 0 apps/<game-id>` pass.
- [ ] Every module part, the assembly, the 3-line entry, catalog keys, the config contract, board goldens, bot sims and E2E flows exist (stage complete), and `npm run verify` is green.
- [ ] The owner's steps are listed in the report with the placeholder that applies until each is done; the bundle id is the owner's.
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/check-game-app.mjs . --app <game-id>` prints `RESULT: PASS`

## Anti-patterns

- **`cp -R apps/line-siege apps/new-game` and search-and-replace.** Old ids, texts and art survive in corners; scaffold instead.
- **`create-expo-app` for a new game.** It brings Expo Router, web dependencies and route files; the scaffold's skeleton already holds everything.
- **Installing a package in the new app only.** Every app lists the same set; install in all apps together or not at all.
- **Importing `game.config.ts` from `src/`.** Runtime values arrive through `expo.extra.game` (`readGameExtra`); the config file is for the composer.
- **Editing `ios/` or `android/`.** They are regenerated by prebuild; change `game.config.ts`, `withShell` or a config plugin.
- **Inventing a bundle id or AdMob ids "for now" that look real.** Keep the documented placeholders until the owner provides them.
- **Switching `index.ts` to the 3-line entry before `src/index.ts` exists.** The app stops type-checking; switch at assembly.
- **Moving files aside so `--write` works on an existing app.** Use `--add-missing`; it never overwrites and lists what it kept.
- **Accepting `hints.freePerDay: 1` or a continue the rules do not have.** Pass `--hints` and `--continue` from the design notes; `--stage complete` fails a continue without `rules.continueRun`.
- **Writing `<id>.lose-reason` or `<id>.result.*` keys.** They are retired; each loss has `<id>.lose.<reason>`.
- **Treating `--stage scaffold` passing as done.** It proves the skeleton only; the game is done at `--stage complete`.

## Files in this skill

| File | What it is | Read/run when |
|---|---|---|
| [references/new-game-checklist.md](references/new-game-checklist.md) | Before code, scaffold commands, the build order with skills and proofs, completion, owner steps, release | Workflow steps 1, 5 and 6 |
| [references/app-files.md](references/app-files.md) | Every generated file and why; `game.config.ts` field by field; catalogs and copy-deck keys; later `src/` folders | Step 4, or when a check names a file |
| [references/ids-and-names.md](references/ids-and-names.md) | The game id's forms, owner-approved ids, placeholders, ids inside the game, outside names | Step 2 |
| `templates/app/` | The app skeleton with `__GAME_ID__`, `__BUNDLE_ID__`, `__NAME_EN__` and the settings placeholders (`__MODE_DAILY__`, `__MODE_ENDLESS__`, `__HINTS_FREE_PER_DAY__`, `__IS_CONTINUE_ALLOWED__`, `__VIOLENCE_RATING__`); `dot-gitignore` becomes `.gitignore`. `package.json` (the minimal first-app set), `game.config.ts`, `index.ts` (the placeholder), `.gitignore`, `tsconfig.json`, `metro.config.js` and `app.config.ts` are synced from the library, the same bytes the monorepo bootstrap writes for the pilot (do not edit them here) | Read when resolving a conflict; the script writes it |
| `templates/app/src/i18n/` | The template catalogs for a game outside the copy deck: every key the Tap Flip templates of the game skills use, in en, de, fa and ckb, with `__GAME_ID__` and `__LOSE_SLUG__` | The script fills them; replace the texts with the game's own |
| `templates/tooling/new-game.ts` | `packages/tooling/src/scaffold/new-game.ts`: the root `npm run new-game` forwards to `scaffold-game.mjs` (synced from the library; do not edit here) | Step 2, once per repo |
| [examples/owner-request.md](examples/owner-request.md) | The one message asking the owner for G1 to G5 with defaults | Step 1 |
| `examples/flock-tilt/` | `scaffold-plan.txt` (a dry run with `--hints solver --continue once`), the generated `game.config.ts` and `en.json` from the copy deck (lose key `flock-tilt.lose.wolf-got-sheep`) | Steps 2 and 4 |
| `scripts/scaffold-game.mjs` | Generator: plan (default), `--write` (a new app) or `--add-missing` (only the absent files of an existing app); `--hints`, `--continue`, `--lose-reason`, `--violence-rating`; lockstep dependencies, catalogs, fonts; never overwrites | Steps 2 and 3 |
| `scripts/check-game-app.mjs` | Checker: `--stage scaffold` (skeleton, the root `new-game` script's file, every key the copied templates use, the copy deck's words for a deck game (`deck-text`), placeholders outside `ios/`, `build/`, `out/` and Pods) or `complete` (every part, assembly and identity, the engine's `panMode`, entry, keys, config contract, evidence, no `shell-slice.json`) | Steps 4 and 6, and at the end |
| `scripts/lib/` | `app-plan.mjs` (the file plan), `app-checks.mjs` (the checks), `app-modules.mjs` (loads TypeScript), `ts-scan.mjs`, `assemble-fixtures.mjs`, and `app-files.mjs` (the per-app renderer shared with the monorepo bootstrap: pilot settings, `game.config.ts` rendering, catalogs, lose slugs; synced from the library, do not edit here) | When changing a script |
| `scripts/selftest.mjs` | Proves both scripts: the generator's plan, conflicts and `--add-missing` on a pilot (3 planted bugs), and the checker on freshly scaffolded apps next to Pods and build noise, the completed pilot and a game outside the deck (32 planted bugs, among them a placeholder beside Pods, a missing template key, a retired lose key, a changed deck text, the pilot's old march text and a `shell-slice.json`) | After changing a script or a template |
| `scripts/check-lib.mjs` | Shared script helper, synced from the library (do not edit here) | Never by hand |
| `assets/fonts/` | LilitaOne, Rubik, Vazirmatn TTFs, OFL texts, SOURCES.md (synced from the library) | The script copies them |
| `assets/copy-deck.json` | The copy deck: game names, texts, pack names, modes (synced from the library) | The script reads it |
| `assets/line-siege-i18n/` | The canonical Line Siege catalogs `en.json`, `de.json`, `fa.json`, `ckb.json` (synced from the library) | The script copies them for the pilot |
| `assets/shared.json` | Declares the shared files this skill copies in | When adding a shared file |
| `tests/fixtures/` | `scaffold-game/` and `scaffold-game-add-missing/` repos, `check-game-app-scaffold/bad-*`, `check-game-app-complete/` (base stubs and bad-*), `check-game-app-pilot/` and `check-game-app-template-keys/` | When adding a rule |

## Related skills

- `monorepo-bootstrap` - the repo, the Shell packages and the pilot app before any second game.
- `game-rules-engine` - the rules, persistence, counters and bot of the new game.
- `level-generation-and-solvers` - solver, level plan, packs and the daily level.
- `game-host-integration` - `src/index.ts`, the types bag, teaching, the contract test and the 3-line entry.
- `board-rendering-skia` and `board-gestures-and-input` - the board and its input.
- `toybox-design-system` - the game's palette and fonts.
- `i18n-strings-and-catalogs` - writing and translating the game's texts.
- `dependency-management` - keeping every app's dependencies in lockstep.
- `ios-release-testflight` - the owner steps and the first TestFlight build.
