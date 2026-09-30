# Pocket Arcade skill library

This folder holds the skills Claude Code uses to build Pocket Arcade: one reusable Shell and about 26 small offline 2D games, each its own iOS app, built entirely by Claude Code. The owner never reads the code, so everything that must be true about it is written down here as skills, and every skill proves its own work with scripts.

A skill is a folder with a `SKILL.md` (the rules, the workflow, the definition of done), plus the references, templates, examples, data and check scripts it needs. Each skill is complete on its own: it never points at a project document, because the knowledge it needs has been copied into it. Each skill's scripts come with a self-test that proves they catch the mistakes they exist to catch.

## Contents

- How a task uses the skills
- Naming skills in a task
- The catalogue
- Library commands
- The rules every skill follows
- Folder map

## How a task uses the skills

1. Claude Code sees the skills through links in `.claude/skills/` (one per skill folder here). Sessions start at the repo root.
2. Every task starts with `pocket-arcade-index`: its task table names the skills a task needs (the first one leads), its build orders say what comes before what, and it says how to report. It lists exactly the skills in this folder, and its `check-index.mjs` proves that.
3. Claude loads the skills of the task's row, works test-first, runs each loaded skill's checks until they print `RESULT: PASS`, and ends with a plain-language report to the owner.

## Naming skills in a task

The owner can name the skills a task must use, on one line at the start of the task:

```text
Skills: /toybox-screens /tdd-workflow /toybox-visual-parity
Build the Levels screen (S8).
```

Named skills are always loaded and their definitions of done are binding; `pocket-arcade-index` adds the other skills of the task's row. Typing `/skill-name` anywhere in a prompt, or writing "use the toybox-screens skill", loads that skill too. Names are exact: the catalogue below lists every one.

## The catalogue

45 skills in ten groups. The one-line summaries here are for people; the full descriptions Claude Code reads are in `pocket-arcade-index/references/skill-table.md` (generated from each skill's frontmatter).

### Start here

- `pocket-arcade-index`: which skills a task needs, the build orders for the Shell and for each game, how to load skills and report.
- `pocket-arcade-product-spec`: what the product must do: screens S1-S15, non-negotiables N1-N12, features, the game contract, the 26 games, open decisions.

### How every change is made

- `tdd-workflow`: the red-green-refactor loop, test names, the order of layers, the evidence each change needs.
- `quality-gates`: `check:fast`, `verify`, the git and Claude Code hooks, the guardrail, and fixing a failing gate without weakening it.
- `git-commits-and-reporting`: commit messages and trailers, release tags, the owner report, stop-and-ask messages.
- `troubleshooting-playbook`: a catalogue of 300+ known failures with their causes and fixes, and a pitfall scanner.
- `skill-maintenance`: adding and changing skills to this library's standard, with routing checks.

### Repo, code rules and packages

- `monorepo-bootstrap`: creates the monorepo, its configs and the pilot app from an empty repo.
- `architecture-and-boundaries`: where code goes, which package may import which, the nine ports, build variants.
- `typescript-and-lint-rules`: the strict tsconfigs, the ESLint config, the size and complexity limits.
- `naming-conventions`: names of files, identifiers, testIDs, message keys, scripts, packages and tags.
- `dependency-management`: adding, upgrading and removing packages under the pinning and release-age policy.
- `expo-sdk-upgrade`: moving every app to the next Expo SDK or Xcode together.

### Toybox look and Shell screens

- `toybox-design-system`: the Toybox tokens, palettes, fonts, text styles, presses and shadows.
- `toybox-components`: the 53 Toybox components with their measurements, states, testIDs and tests.
- `code-drawn-art-and-icons`: the icons, game logos, app icon and splash, all drawn in code.
- `toybox-screens`: the build spec of every screen S1-S15: layout, components, testIDs, copy keys, states.
- `toybox-visual-parity`: proves every built screen matches its Toybox design screenshot, light and dark, English and Persian.
- `react-components-and-hooks`: the React rules for components and hooks: effects, selectors, lists, layout, reduce motion.
- `navigation-and-routing`: the one navigation stack, its routes, typed params and the Back rule.
- `settings-and-preferences`: the Settings screen's saved fields, rows and the effect of each setting.

### Data and saved state

- `state-stores`: the Zustand stores, pure reducers and the game session reducer.
- `save-persistence-and-migrations`: the save document, SQLite writes, backups, migrations and the kill test.
- `daily-and-statistics`: the daily challenge, streaks and the statistics, from date keys to the screens' summaries.

### Languages, direction, access and speed

- `i18n-strings-and-catalogs`: every visible text through message catalogs in four languages, from the copy deck.
- `rtl-and-direction`: right-to-left layout for Persian and Sorani, digits, mirroring, the direction switch.
- `accessibility`: VoiceOver roles and names, 44 pt targets, 200 % text, contrast, reduce motion.
- `performance-budgets`: cold start, frame, save, draw-call, bundle and memory budgets, and how to measure them.

### Building a game

- `new-game-scaffold`: creates a new game app from a script and proves it complete at the end.
- `game-rules-engine`: a game's pure, deterministic rules behind the game contract, with the seeded random numbers.
- `level-generation-and-solvers`: generated levels proven by a solver, par, stars, packs and the daily level.
- `board-rendering-skia`: drawing and animating a game board with Skia, with pixel goldens.
- `board-gestures-and-input`: taps, swipes, drags and aim on a board, turned into moves.
- `realtime-game-loop`: fixed-step real-time play and simulate-then-replay phases, with replay tests.
- `game-audio-and-haptics`: synthesised sounds, music and haptics, and when they play.
- `game-balance-and-bots`: headless bots, simulations, balance bands and the fun-within-seconds test.
- `game-host-integration`: wiring a game into the Shell: the Game screen, pause, result, the run end.

### Ads, Premium and privacy

- `admob-ads`: AdMob banners, interstitials and rewarded ads, consent, and the ad policy.
- `premium-purchase`: the one Premium purchase per game, every Premium page state, restore and refunds.
- `privacy-and-network-audit`: the proof that our code makes no network requests, the privacy manifest, the release audit.

### Tests beyond the unit loop

- `unit-and-component-tests`: the Jest set-up and how to write unit, component, hook and adapter tests.
- `golden-tests`: level, daily and board goldens, and the rule that they change only on purpose.
- `e2e-maestro`: end-to-end flows on the simulator, the no-network check and the screenshot matrix.

### Build and release

- `ios-simulator-build`: Release simulator builds of the test and store variants, proven by a screenshot.
- `ios-release-testflight`: signing, uploading and processing a build on TestFlight, with the owner's go.

## Library commands

Run from the repo root. Every command prints `--help`, exits 0 (pass), 1 (problems found) or 2 (bad input), and ends with `RESULT: PASS` or `RESULT: FAIL (<n> problems)`.

| Command | What it does |
|---|---|
| `node skills/_library/sync-shared.mjs` | Copies the shared files (script helper, tokens, copy deck, fonts, testID map, tooling files) into every skill that declares them |
| `node skills/_library/validate-skills.mjs` | Checks every skill against the authoring standard (frontmatter, sections, links, files table, no project references, scripts) |
| `node skills/_library/selftest-all.mjs` | Runs the library's own tests and every skill's self-test |
| `node skills/_library/link-skills.mjs` | Creates the `.claude/skills/<name>` links so Claude Code sees new skills (`--check` only reports) |
| `node skills/_library/check-staleness.mjs` | Lists skill files whose recorded project sources changed since they were copied |
| `node skills/_library/refresh-shared.mjs` | Re-imports the Toybox tokens and the copy deck after a design change |
| `node skills/_library/record-sources.mjs <skill> <file> <sources...>` | Records where a skill file's knowledge was copied from |
| `node skills/pocket-arcade-index/scripts/build-index.mjs --write` | Regenerates the index (skill table, task matrix, build orders) after a skill is added, removed or re-described |
| `node skills/pocket-arcade-index/scripts/check-index.mjs --readme skills/README.md` | Proves the index and this README list exactly the skills present |
| `node skills/skill-maintenance/scripts/check-skill-set.mjs skills` | Finds overlapping descriptions, unknown hand-offs and the listing budget across all skills |
| `node skills/skill-maintenance/scripts/check-routing.mjs --skills-root skills` | Runs the routing evals: does each typical task reach its skill |

After any change to a skill: `sync-shared`, `validate-skills`, `selftest-all`, then `build-index --write` and `check-index` when the skill set or a description changed, then `link-skills` for a new skill (it writes under `.claude/`, which asks the owner once).

## The rules every skill follows

- **Self-contained:** a skill never refers to project documents, design files or another skill's folder; it carries copies of what it needs. Another skill may be named for a hand-off only.
- **Self-verifying:** every skill ends its definition of done with a script that prints `RESULT: PASS`, and every script has a self-test with a good fixture and one planted bug per rule.
- **Short descriptions that route:** at most 300 characters, starting with a verb, with "Use when" and "Not for (other-skill)", so Claude Code picks the right skill from the description alone.
- **Rules first:** the rules and the definition of done sit at the top of `SKILL.md` (at most 300 lines), because only the first part of a skill survives a long session.

The binding standard and the build catalogue are `_library/AUTHORING-STANDARD.md` and `_library/CATALOGUE.md`; `_library/README.md` documents every library tool.

## Folder map

```text
skills/
  README.md                 this file
  _library/                 the tools that validate, sync, test and link the skills
  <skill-name>/             one folder per skill (45)
    SKILL.md                rules, workflow, definition of done, files, related skills
    references/             knowledge read on demand
    templates/              files copied into the app repo (real, compiling code and config)
    examples/               complete worked examples
    scripts/                checkers and generators, with selftest.mjs
    tests/fixtures/         good and planted-bad inputs for the self-test
    assets/                 data files (tokens, fonts, reference images, manifests)
```
