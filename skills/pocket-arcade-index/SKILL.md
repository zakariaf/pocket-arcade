---
name: pocket-arcade-index
description: Routes any Pocket Arcade task to the skills it needs - the skill catalogue, a task-to-skills matrix, build orders for the Shell and each new game, loading and reporting. Use when starting or planning a task, or unsure which skill applies. Not for product rules (pocket-arcade-product-spec).
---

# Pocket Arcade index

Every Pocket Arcade task starts here: find its row in the task table, load every skill the row names, build in the documented order, prove the work with each loaded skill's own checks, and report in the owner's format. The index lists exactly the skills that exist, and a script proves it.

## Rules that must hold

1. **Load every skill of the matching row before writing code, plus every skill the owner names.** A skill's rules and checks only protect work done with it loaded; loading only the most obvious skill is the most common way a task goes wrong (an unlocalised string, a screen that never met its design screenshot, a save written the wrong way).
2. **The owner's named skills are binding.** "Skills: /toybox-screens /tdd-workflow ..." in a task means those skills are loaded and their definitions of done hold; the row's other skills are added, never swapped for them.
3. **Code is always test-first and always reported:** `tdd-workflow` joins every task that changes code, and `git-commits-and-reporting` every task that commits or reports. The owner never reads code, so the tests and the report are the review.
4. **Every screen task includes `toybox-visual-parity`.** The owner's rule: every built screen matches its Toybox design screenshot, in light and dark, English and Persian.
5. **Build in the documented order** (`references/build-orders.md`): a layer starts only when the layer it depends on passes its check. A screen built on untested rules fails in the wrong place.
6. **Done means every loaded skill's checks print `RESULT: PASS`**, plus `npm run -s check:fast` once the repo has it. `SKIP` lines (a rule a repo fact puts out of reach: a screen outside `shell-slice.json`, or a rule not yet due because a later build step creates its target, `due at Shell step <n>: <file> not yet created`) and `NOT APPLICABLE` (a fact proves the whole check does not apply) end in `RESULT: PASS` and count as a pass; exit 2 (nothing to check, bad input) never does. A check that could not run is named in the report with the reason, never skipped silently.
7. **When no row fits,** read the one-line descriptions in `references/skill-table.md` and load every skill whose description matches the task; when the task is about what the product must do, load `pocket-arcade-product-spec` first. Never guess a skill's content from its name.
8. **The index lists exactly the skills in the library.** After any skill is added, removed, renamed or re-described, run `build-index.mjs --write` and `check-index.mjs`; a stale index routes tasks to skills that are gone.

## The task table

Several rows can apply to one task: load the union. The notes for each row, and a longer explanation, are in [references/task-matrix.md](references/task-matrix.md).

<!-- generated:task-table:start (build-index.mjs; edit assets/index.json instead) -->
| Task | Load these skills (the first one leads) |
|---|---|
| Bootstrap the monorepo from an empty or docs-only repo | `monorepo-bootstrap` `dependency-management` `quality-gates` `typescript-and-lint-rules` `architecture-and-boundaries` `unit-and-component-tests` `git-commits-and-reporting` |
| Build the Home screen (S4) | `toybox-screens` `toybox-components` `toybox-design-system` `i18n-strings-and-catalogs` `rtl-and-direction` `accessibility` `toybox-visual-parity` `unit-and-component-tests` `tdd-workflow` `navigation-and-routing` `daily-and-statistics` `admob-ads` |
| Build or change any other Shell screen, overlay or dialog (S1-S15) | `toybox-screens` `toybox-components` `toybox-design-system` `i18n-strings-and-catalogs` `rtl-and-direction` `accessibility` `toybox-visual-parity` `react-components-and-hooks` `navigation-and-routing` `unit-and-component-tests` `tdd-workflow` |
| Build the Settings screen or add a setting (S11) | `settings-and-preferences` `toybox-screens` `state-stores` `save-persistence-and-migrations` `i18n-strings-and-catalogs` `rtl-and-direction` `toybox-visual-parity` `tdd-workflow` |
| Sell Premium or change the purchase flow (S12) | `premium-purchase` `toybox-screens` `state-stores` `save-persistence-and-migrations` `i18n-strings-and-catalogs` `toybox-visual-parity` `privacy-and-network-audit` `tdd-workflow` |
| Add or change ads, consent or a rewarded perk | `admob-ads` `architecture-and-boundaries` `game-host-integration` `settings-and-preferences` `privacy-and-network-audit` `unit-and-component-tests` `tdd-workflow` |
| Add or restyle a Toybox component | `toybox-components` `toybox-design-system` `code-drawn-art-and-icons` `accessibility` `react-components-and-hooks` `unit-and-component-tests` `tdd-workflow` `toybox-visual-parity` |
| Change colours, fonts, dark mode or a game's palette | `toybox-design-system` `accessibility` `toybox-visual-parity` `toybox-components` |
| Add an icon, a game logo, the app icon or the splash | `code-drawn-art-and-icons` `toybox-design-system` `golden-tests` `ios-simulator-build` |
| Add or change visible text, a message key or a translation | `i18n-strings-and-catalogs` `rtl-and-direction` `naming-conventions` `accessibility` |
| Fix right-to-left layout, mirrored icons or Persian digits | `rtl-and-direction` `i18n-strings-and-catalogs` `toybox-visual-parity` `e2e-maestro` |
| Add a route or wire navigation between screens | `navigation-and-routing` `toybox-screens` `react-components-and-hooks` `state-stores` `tdd-workflow` |
| Add a store, an action or a selector | `state-stores` `save-persistence-and-migrations` `react-components-and-hooks` `unit-and-component-tests` `tdd-workflow` |
| Change what is saved or the save format | `save-persistence-and-migrations` `state-stores` `golden-tests` `git-commits-and-reporting` `tdd-workflow` |
| Build the daily challenge, streaks or the statistics | `daily-and-statistics` `level-generation-and-solvers` `state-stores` `save-persistence-and-migrations` `toybox-screens` `toybox-visual-parity` `tdd-workflow` |
| Start a new game app | `new-game-scaffold` `pocket-arcade-product-spec` `dependency-management` `architecture-and-boundaries` `git-commits-and-reporting` |
| Write or change a game's rules, moves or scoring | `game-rules-engine` `tdd-workflow` `unit-and-component-tests` `naming-conventions` `game-balance-and-bots` |
| Add levels, a solver, par, stars, packs or the daily level | `level-generation-and-solvers` `game-rules-engine` `golden-tests` `daily-and-statistics` `tdd-workflow` |
| Draw or animate a game board | `board-rendering-skia` `board-gestures-and-input` `golden-tests` `accessibility` `performance-budgets` `rtl-and-direction` `tdd-workflow` |
| Add taps, swipes, drags or aim on a board | `board-gestures-and-input` `board-rendering-skia` `game-rules-engine` `accessibility` `tdd-workflow` |
| Build a real-time game or a simulate-then-replay phase | `realtime-game-loop` `board-rendering-skia` `board-gestures-and-input` `game-rules-engine` `game-balance-and-bots` `performance-budgets` `golden-tests` |
| Add or tune sounds, music or haptics | `game-audio-and-haptics` `settings-and-preferences` `board-rendering-skia` `game-host-integration` |
| Balance difficulty or add bots and sims | `game-balance-and-bots` `game-rules-engine` `level-generation-and-solvers` `git-commits-and-reporting` |
| Wire a game into the Shell (Game screen, Pause, Result, run end) | `game-host-integration` `state-stores` `daily-and-statistics` `navigation-and-routing` `toybox-screens` `board-rendering-skia` `admob-ads` `i18n-strings-and-catalogs` |
| Write or fix end-to-end flows or the screenshot matrix | `e2e-maestro` `ios-simulator-build` `toybox-visual-parity` `privacy-and-network-audit` `golden-tests` |
| Prove a screen matches its Toybox design screenshot | `toybox-visual-parity` `ios-simulator-build` `toybox-screens` `toybox-components` `toybox-design-system` |
| Build, run or smoke-test on the iOS simulator | `ios-simulator-build` `troubleshooting-playbook` `architecture-and-boundaries` |
| Release a game to TestFlight | `ios-release-testflight` `privacy-and-network-audit` `e2e-maestro` `toybox-visual-parity` `game-balance-and-bots` `i18n-strings-and-catalogs` `git-commits-and-reporting` |
| Add, upgrade or remove an npm package | `dependency-management` `privacy-and-network-audit` `performance-budgets` `ios-simulator-build` `quality-gates` |
| Move to a new Expo SDK or Xcode version | `expo-sdk-upgrade` `dependency-management` `board-gestures-and-input` `unit-and-component-tests` `golden-tests` `ios-simulator-build` `e2e-maestro` |
| A quality gate, hook or verify run fails | `quality-gates` `troubleshooting-playbook` `typescript-and-lint-rules` `unit-and-component-tests` |
| Fix a TypeScript or ESLint error, or split a file that is too long | `typescript-and-lint-rules` `naming-conventions` `architecture-and-boundaries` `quality-gates` |
| Place a new file, package, port or adapter | `architecture-and-boundaries` `naming-conventions` `typescript-and-lint-rules` `unit-and-component-tests` |
| Something errors, crashes, hangs or renders wrong | `troubleshooting-playbook` `quality-gates` `ios-simulator-build` |
| Check or improve performance | `performance-budgets` `board-rendering-skia` `react-components-and-hooks` `realtime-game-loop` |
| Review accessibility or VoiceOver | `accessibility` `toybox-components` `i18n-strings-and-catalogs` `e2e-maestro` |
| Prove the app makes no network requests, or answer App Privacy | `privacy-and-network-audit` `admob-ads` `premium-purchase` `e2e-maestro` `dependency-management` |
| A golden or snapshot test shows a diff | `golden-tests` `level-generation-and-solvers` `board-rendering-skia` `git-commits-and-reporting` |
| Commit, tag, report to the owner or ask the owner a question | `git-commits-and-reporting` `pocket-arcade-product-spec` `quality-gates` |
| Find out what the spec requires (a screen, rule, feature or game) | `pocket-arcade-product-spec` `pocket-arcade-index` |
| Create, change or repair a skill | `skill-maintenance` `pocket-arcade-index` `git-commits-and-reporting` |
<!-- generated:task-table:end -->

## Workflow

1. **Match the task.** Find its row (or rows) in the table above. A spec ID in the task (S4, N3, 8.8) points at a screen or rule: the row for that screen or area, plus `pocket-arcade-product-spec` to quote it exactly.
2. **Load the skills.** Load each skill of the row with the Skill tool (or `/skill-name`), the lead first, and read each one's Rules and Definition of done before starting. [references/loading-and-reporting.md](references/loading-and-reporting.md) explains loading, the owner's "Skills:" line and what to do when a skill will not load.
3. **Place the work.** For building the Shell or a new game, find the current step in [references/build-orders.md](references/build-orders.md); do not start a step whose predecessor has not passed its check. Run each step's "done when" commands exactly as written there (repo root as the first argument, never `--root`). A repo without every Shell screen declares it in `shell-slice.json` (the same reference says how, lists the partial Shell core every Shell app keeps whatever the slice, gives the order for adding the pilot's Game, Pause and Result to an existing slice, and says that a slice never ships), and its table "When npm run verify is green" says which verify steps are still expected red at the current step.
4. **Do the work** as the lead skill's workflow says, test-first, with the other loaded skills' rules applied to the parts they own.
5. **Prove it.** Run every loaded skill's definition-of-done checks and `npm run -s check:fast`; fix every `FAIL` line and rerun until each prints `RESULT: PASS`.
6. **Report.** Write the owner report as [references/loading-and-reporting.md](references/loading-and-reporting.md) ("Reporting") says: outcome first, the skills used, their `RESULT` lines, what was not verified, at most one question.
7. **Keep the index exact** (only when skills changed): `node ${CLAUDE_SKILL_DIR}/scripts/build-index.mjs --write`, then `node ${CLAUDE_SKILL_DIR}/scripts/check-index.mjs --readme skills/README.md` (the library README's catalogue is checked too; add the new skill there by hand), fixing every `FAIL` line until it prints `RESULT: PASS`.

## Definition of done

- [ ] Every skill of the matching rows, and every skill the owner named, was loaded before the work started.
- [ ] Each loaded skill's definition-of-done checks print `RESULT: PASS` (SKIP lines and NOT APPLICABLE included; an exit 2 is not a pass, and the report names any check that could not run and why), and `npm run -s check:fast` is green.
- [ ] Build work followed the build order; no step started before its predecessor passed.
- [ ] The report names the skills used, their `RESULT` lines and what was not verified.
- [ ] After any change to the skill set or a description, `build-index.mjs --write` ran.
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/check-index.mjs` prints `RESULT: PASS`

## Anti-patterns

- **Loading one skill because its name matches.** "Build the Home screen" with only `toybox-screens` misses the texts, the mirroring, the VoiceOver names and the design comparison; load the whole row.
- **Starting the board before the rules are proven.** The build order exists because a layer debugged through the layer above it costs many times more.
- **Declaring done from `check:fast` alone.** Each loaded skill has its own check for the things lint and Jest cannot see (testIDs, copy keys, save order, parity).
- **Reading an exit 2 as "not applicable".** Exit 2 means the check found nothing to check or got bad input (often a guessed `--root`); rerun it with the command from the build order. Only `SKIP` lines and `NOT APPLICABLE` before `RESULT: PASS` mean a rule did not apply.
- **Editing `references/skill-table.md` or the task table by hand.** The next generation overwrites it and `check-index.mjs` reports it; edit `assets/index.json` or the skill's description, then regenerate.
- **Inventing a skill name** ("the audio skill", "/ads"). Use the exact names from the catalogue; a wrong name loads nothing.
- **A report that lists work instead of outcome.** The owner reads the first lines only: what now works for players, then the evidence.

## Files in this skill

| File | What it is | Read/run when |
|---|---|---|
| [references/skill-table.md](references/skill-table.md) | Every skill with its description, by group (generated) | When no task row fits, or to see what a skill covers |
| [references/task-matrix.md](references/task-matrix.md) | The task table with a note per row (generated) | Workflow step 1 |
| [references/build-orders.md](references/build-orders.md) | Build order for the Shell with the pilot game and for every new game: step, skills, the exact "done when" commands (with the not-yet-due SKIP lines each step expects); the partial Shell (`shell-slice.json`), its core files and owners, the pilot game into an existing slice, and when `npm run verify` is green (generated) | Workflow step 3 |
| [references/loading-and-reporting.md](references/loading-and-reporting.md) | Loading skills by name or `/name`, the owner's "Skills:" line, compaction, reporting, asking the owner | Workflow steps 2 and 6 |
| `assets/index.json` | The curated data: groups, task rows, build steps, the partial Shell core (`buildOrders.sliceCore`) and the extra orders (`buildOrders.extraOrders`) (the one place to edit) | When the skill set, a task pattern or a build step changes |
| `scripts/build-index.mjs` | Renders the generated parts from `assets/index.json` and every skill's frontmatter; without `--write` it only reports | Workflow step 7 |
| `scripts/check-index.mjs` | Proves the index (and, with `--readme`, the library README's catalogue) lists exactly the skills present, routes to each, is current, and that every `<name>.mjs` command in the build orders is a real script of the skill named after it (`command-unknown`) | Workflow step 7 and the definition of done |
| `scripts/lib/index-model.mjs` | Frontmatter reader, data loader and renderers shared by both scripts | Never by hand |
| `scripts/selftest.mjs` | Proves both scripts pass a good library and catch each planted bug | After changing a script |
| `scripts/check-lib.mjs` | Shared script helper, synced from the library (do not edit here) | Never by hand |
| `assets/shared.json` | Declares the shared files this skill copies in | When adding a shared file |
| `tests/fixtures/` | Small skill libraries, good and planted-bad, for both scripts | When adding a rule |

## Related skills

- `pocket-arcade-product-spec` - what the product must do: screens, rules, features, games and open decisions.
- `tdd-workflow` - the test-first loop every code task follows.
- `git-commits-and-reporting` - commit messages and the owner report format.
- `skill-maintenance` - adding or changing a skill (then regenerate this index).
