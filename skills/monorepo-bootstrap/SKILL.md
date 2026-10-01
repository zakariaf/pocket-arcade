---
name: monorepo-bootstrap
description: "Creates the Pocket Arcade monorepo in an empty or docs-only repo: workspaces, game-kit, shell, tooling, pilot Expo SDK 57 app, root configs, .npmrc, Claude settings. Use when bootstrapping, setting up or scaffolding the repo. Not for new games (new-game-scaffold) or installs (dependency-management)."
---

# Monorepo bootstrap

Turns an empty (or docs-only) folder into the Pocket Arcade monorepo: every root config, the three packages, the pilot app and the tooling gate scripts, generated from templates that were installed and run end to end, with every gate that exists green and a checker that proves the result.

## Rules that must hold

1. **Generate the skeleton with `scaffold-monorepo.mjs`; never type the configs by hand.** Every template was installed and run on 2026-09-28 (ESLint, tsc, Jest, knip, the guardrail, `expo config`, `expo export`); a hand-typed config drifts from the gates on the first character.
2. **Bootstrap at the repo root, inside a git repository, and leave pre-existing folders where they are.** Hooks install through `npm install` only in a git repo, and Claude Code loads hooks and permissions only from the root; the generator adds pre-existing entries to the Prettier and ESLint ignores instead of moving or reformatting the owner's files.
3. **Never overwrite a file that differs from its template without reading both.** Conflicts are reported, not written; `.gitignore` and `.claude/settings.json` are merged, and extra deny or ask rules or hooks in an existing settings file are a question for the owner, because the guardrail compares them exactly.
4. **Install exactly the verified Expo SDK 57 set, pinned, with a committed lockfile, and keep the root `overrides` whole.** One written truth (the `dependency-management` versions table) stops "upgrades" to npm `latest`, which is the wrong major for several packages. The skeleton ships no lockfile, so the `overrides` make every bootstrap resolve the same tree: one React and React Native, one typescript-eslint (all ten `@typescript-eslint/*` at 8.70.1; a newer copy crashes ESLint with `Cannot redefine plugin "@typescript-eslint"`) and one copy of each native module the Shell peers on (at the version the apps install).
5. **Install only what the skeleton uses.** knip fails on unused dependencies, so the pilot's `package.json` is the minimal runtime set and every other package arrives with the skill that first imports it, through the `dependency-management` skill.
6. **Keep the dated `.npmrc` exclude block only until its `expires=` date (2026-10-03), then delete it.** It exists because several verified versions were younger than the 7-day `min-release-age`; the generator omits it after the date and the checks fail on an expired block.
7. **Approve install scripts one package at a time, after reading them.** npm will soon block unreviewed scripts, and each approval is pinned to the reviewed version.
8. **The pilot is Line Siege v1 and passes the new-game checks from the start.** The generator writes its `.gitignore`, fonts and four canonical catalogs and fills `game.config.ts` from the game's rules (levels, daily and endless; no hints; one continue; violence `INFREQUENT_OR_MILD`), with the same shared templates the `new-game-scaffold` skill uses, so the two skills never disagree about a file.
9. **Treat the composer and `index.ts` as phase 0.** `app.config.ts` is the one statement `export default withShell(gameConfig, process.env);`. The bootstrap's `with-shell.ts` (with its test) and `ads-config.ts` are phase-0 files: at the Shell's native step (before the first simulator build) architecture-and-boundaries' final `with-shell.ts` and `shell-plugins.ts` (the one plugin list) and admob-ads' `ads-config.ts` replace them, and game-host-integration's 3-line `startShell` entry replaces the placeholder `index.ts`; never edit `ios/`.
10. **Never stub a missing tool script to make `npm run verify` pass.** `i18n:verify`, `test:sim`, `audit:network` and `audit:licenses` are pending until their skills build them; a gate that passes without checking hides every later failure.
11. **Stop and ask for human steps.** Installing Xcode, accepting its licence, `sudo`, the App Store Connect key and trusting the folder in Claude Code are the owner's; ask once, with the default that applies meanwhile.

## Workflow

1. Read [references/toolchain-setup.md](references/toolchain-setup.md) and run its "Checks to run before installing" (Node 26.4.0, npm 11.17.0, git). Ask the owner for any human step that is missing.
2. Confirm the pilot's details with the owner. The pilot is always Line Siege v1 (`--app line-siege`; the generator refuses another id, and every later game comes from the `new-game-scaffold` skill): its display name only: the bundle id is fixed (`io.applander.linesiege`, Premium `io.applander.linesiege.premium`; owner decision O4: every game uses the Applander domain, `io.applander.<game id without hyphens>`), and the generator writes it. Also the Persian and Sorani names if known (they need a native-speaker review later), and the age-rating answer `INFREQUENT_OR_MILD` for cartoon violence (blocks hit monsters).
3. Read [references/repo-layout.md](references/repo-layout.md) so the tree, the phase-0 files and the pre-existing-folder handling are clear. Run `git status`; never discard work you did not make. Run `git init` only if the folder is not a repository yet.
4. Plan without writing: `node ${CLAUDE_SKILL_DIR}/scripts/scaffold-monorepo.mjs --root . --app line-siege --name "Line Siege"` (add `--name-fa`, `--name-ckb` as agreed; there is no bundle id option). Read the plan: the pre-existing entries it will ignore, the merges, and every `conflict`.
5. Resolve each conflict with [references/root-files.md](references/root-files.md) ("Merging an existing repo"): edit the file to the template content, or rerun with `--replace <file>` when the existing file is an old draft; ask the owner when an existing settings rule would be dropped.
6. Write: the same command with `--write`. Rerun the dry run; it must print `0 new, 0 merged` and `RESULT: PASS`.
7. Install and approve install scripts exactly as in [references/first-install-and-verify.md](references/first-install-and-verify.md) ("Install and approve install scripts"): `npm install`, review, `npm approve-scripts <pkg>` one by one (`fsevents` too when a later install lists it), until `--allow-scripts-pending` prints `No packages with unreviewed install scripts.`; `npm ls react react-native @typescript-eslint/eslint-plugin` shows one version each.
8. Run `npm run format` once (merged JSON), then run every gate that exists, one by one ("The gate runs, one by one"), and the Expo config for the three allowed variants plus the introspection and export ("The Expo config for every allowed variant"). Fix the cause of any failure in the files, then rerun; a failing gate is never loosened.
9. Run `node ${CLAUDE_SKILL_DIR}/scripts/check-monorepo.mjs .`; fix every `FAIL` line (each names the file, the rule and the fix) and rerun until `RESULT: PASS`. Note the `pending` lines for the report.
10. Make the first commit with the `Gate-Change: initial quality gates` trailer, staging only the files the generator wrote ("The first commit"; never `git add -A`, the owner's own uncommitted work stays out); the hooks must pass. Do not push unless the owner asks.
11. Report to the owner in the shape of [examples/bootstrap-report.md](examples/bootstrap-report.md): outcome, at most one request, what to look at, the pending gates in plain words, then the numbers.

## Definition of done

- [ ] The root, `packages/game-kit`, `packages/shell`, `packages/tooling` and `apps/<pilot>` hold every file of the templates; pre-existing folders are untouched and ignored by Prettier and ESLint.
- [ ] `package-lock.json` is committed; `npm approve-scripts --allow-scripts-pending` prints `No packages with unreviewed install scripts.`; `npm ls react react-native @typescript-eslint/eslint-plugin` shows one version each.
- [ ] `apps/line-siege` holds its `.gitignore`, the eight font files and the four Line Siege catalogs (the `new-game-scaffold` skill's `check-game-app.mjs . --app line-siege --stage scaffold` passes without moving a file).
- [ ] `npm run -s check:fast`, `npm run -s lint`, `npm run -s test:coverage` (thresholds met), `npm run -s knip`, `node packages/tooling/src/quality/check-quality-gates.ts` and `node packages/tooling/src/deps/check-deps.ts` all pass; `npx lefthook validate` prints `All good`.
- [ ] `npx expo config --json` works in the pilot app for test/test, test/off and store/off (no `null` in `extra`, no `adUnits` outside live), and `APP_VARIANT=store` without `EXPO_PUBLIC_APP_VARIANT` fails.
- [ ] `npm run new-game -- --help` prints the new-game generator's usage (the skills folder is in the repo).
- [ ] The first commit went through the hooks with a `Gate-Change:` trailer; nothing was pushed without the owner.
- [ ] The report names the pending gates (`i18n:verify`, `test:sim`, `audit:network`, `audit:licenses`) and the `.npmrc` block's expiry date.
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/check-monorepo.mjs .` prints `RESULT: PASS`

## Anti-patterns

- **Running `create-expo-app` and trimming the template.** It brings Expo Router, `react-dom`, `react-native-web`, route files and an `AGENTS.md` that says "Use Expo Router"; the generated files already hold everything the app needs, and `check-monorepo.mjs` flags the leftovers as `banned`.
- **Installing the whole versions table on day one.** knip then fails on a dozen unused dependencies and the packages age unreviewed; install each one with its first user.
- **Dropping a root override, or excluding `typescript-eslint` or `@typescript-eslint/*` from the release age.** A fresh install then takes whatever npm published that day; on 2026-09-29 that was a one-day-old `@typescript-eslint` 8.71.0 next to 8.70.1, and ESLint crashed on every run.
- **Running the new-game scaffold's `--write` over the pilot.** The pilot already has every file; if one is missing, `scaffold-game.mjs --app line-siege --add-missing` writes only the absent files.
- **Deleting `package-lock.json` or loosening `.npmrc` when an install fails with `ETARGET`.** The version is younger than 7 days; use the dated-exception procedure of the `dependency-management` skill.
- **Reformatting or linting the owner's pre-existing folders.** They are knowledge, not code; they stay in the ignore lists.
- **Adding a stub `verify-catalogs.ts` or `audit-network.ts` so `npm run verify` goes green.** Report the pending gates instead.
- **Editing `quality-gates.json` to match a changed config.** The guardrail exists to catch exactly that; restore the config.
- **Approving install scripts with `npm approve-scripts --all` without reading them.** Review each one; the list and what each script does are in the install reference.
- **Running `npm audit fix` because the install printed "N moderate severity vulnerabilities"** (some moderate advisories; 23 on 2026-09-30, and the count keeps changing). `npm audit` is not a gate: they sit in build tooling (Expo's config plugins, Stryker), not in the app, and the fix it offers (`--force`) moves `expo` off SDK 57; report the count instead.
- **Letting knip scan `skills/`.** Its Jest plugin falls back to test globs everywhere; `knip.json` keeps `"ignore": ["skills/**"]` (and `quality-gates.json` the same list).
- **Changing a root config by editing it under `templates/repo/`.** Most of those files are synced copies: the next sync reverts the edit, and the owning skill would ship different bytes. Change the canonical copy in the skill library's shared folder, run `node skills/_library/sync-shared.mjs`, then this skill's self-test.
- **Selecting Xcode with `sudo xcode-select`.** Use `DEVELOPER_DIR`; Xcode 27 on the same Mac needs scene support first.

## Files in this skill

| File | What it is | Read/run when |
|---|---|---|
| [references/toolchain-setup.md](references/toolchain-setup.md) | Mac, Xcode 26.6 via `DEVELOPER_DIR`, mise, Node, npm, Ruby, CocoaPods, Java, owner steps, prebuild facts | Workflow step 1 |
| [references/repo-layout.md](references/repo-layout.md) | The tree, the four workspace kinds, phase-0 files, who maintains what, TypeScript-source workspaces, pre-existing folders | Workflow step 3 |
| [references/root-files.md](references/root-files.md) | Every root file and the reasons behind it; merging an existing repo | Workflow step 5, and when a check names a config |
| [references/first-install-and-verify.md](references/first-install-and-verify.md) | Install set, approvals, the gate runs, the variant configs, first commit, pending gates, traps, the verified run | Workflow steps 7 to 10 |
| [examples/bootstrap-report.md](examples/bootstrap-report.md) | A complete owner report after the bootstrap | Workflow step 11 |
| `templates/repo/` | Every file of the skeleton (`dot-` names become dotfiles, `__APP_ID__` and `__GAME_ID__` the pilot id, `.tmpl` is dropped). The root configs, the tooling gate scripts, `new-game.ts`, the shared Shell files and the pilot's per-app files (`apps/__APP_ID__/`: `package.json`, `game.config.ts`, the placeholder `index.ts`, `.gitignore`, `tsconfig.json`, `metro.config.js`, `app.config.ts`) are synced from the library, byte for byte the copies the owning skills ship (do not edit them here) | Read when resolving a conflict; the generator writes them |
| `templates/package-scripts.json` | The canonical root npm scripts (synced from the library; the same file the quality-gates skill ships); `check-monorepo.mjs` compares the repo with it | When a script is reported as changed |
| `templates/npmrc-bootstrap-block.txt` | The dated `.npmrc` exclude block (expires 2026-10-03) | The generator includes it while it is valid |
| `templates/tooling-deps/` | The dependency gate, clock and licence audit tooling (synced from the library; do not edit here) | The generator writes it under `packages/tooling/` |
| `scripts/scaffold-monorepo.mjs` | Generator: dry-run plan, `--write`, `--replace`, `--compare`; writes the fixed pilot ids `io.applander.linesiege` and `.premium` (a `--bundle-id` with another value stops with exit 2) | Workflow steps 4 to 6 |
| `scripts/check-monorepo.mjs` | Checker for the whole skeleton (41 rules, including `bundle-id` and `premium-id`: the fixed `io.applander` ids; `root-overrides`: one React, one typescript-eslint, one copy of each Shell native peer; `app-files`: the pilot's fonts and catalogs; `gate-scope` and `stryker-config`: no gate reaches into `skills/` or `.claude/`) | Workflow step 9, and after any change to a root config |
| `scripts/lib/bootstrap-plan.mjs` | Template mapping, rendering, merges, pre-existing detection | Read only to change the generator |
| `scripts/lib/repo-read.mjs` | JSONC, manifest and `.npmrc` readers for the checker | Read only to change the checker |
| `scripts/lib/assemble-fixtures.mjs` | Builds the self-test repo from the templates and plants each bug | Read only to add a self-test case |
| `scripts/selftest.mjs` | Proves both scripts (generator: a clean plan, 3 conflicts and a `--bundle-id` override that stops with exit 2; checker: a freshly generated repo and 33 planted bugs, among them a nested `@typescript-eslint/eslint-plugin`, missing overrides, a missing pilot catalog, a bundle id outside `io.applander` and another Premium id) | After changing a script or a template |
| `scripts/lib/app-files.mjs` | The per-app renderer shared with the new-game scaffold: pilot settings (Line Siege v1), `game.config.ts` placeholders, the font list, catalog rules (synced from the library; do not edit here) | Read only to change what the pilot gets |
| `scripts/check-lib.mjs` | Shared script helper, synced from the library (do not edit here) | Never by hand |
| `assets/fonts/` | The five Toybox TTFs, three OFL texts and `SOURCES.md` (synced from the library); the generator copies them into `apps/line-siege/assets/fonts/` | The generator reads them |
| `assets/line-siege-i18n/` | The canonical Line Siege catalogs `en.json`, `de.json`, `fa.json`, `ckb.json` (synced from the library); the generator copies them into `apps/line-siege/src/i18n/` | The generator reads them; never edit a copy |
| `assets/shared.json` | Declares the shared files copied into this skill | When adding a shared file |
| `tests/fixtures/` | Generator fixtures and the `mutation.json` planted bugs for the checker | When adding a rule |

## Related skills

- `dependency-management` - every package installed after the bootstrap, the versions table, dated exceptions.
- `quality-gates` - what each gate checks and how to fix a failing one.
- `typescript-and-lint-rules` - the tsconfig set and the full ESLint rules.
- `architecture-and-boundaries` - where files go and the dependency zones.
- `unit-and-component-tests` - Jest projects, mocks, coverage.
- `git-commits-and-reporting` - commit format, trailers, owner reports.
- `new-game-scaffold` - every game after the pilot.
- `ios-simulator-build` - prebuild and the first simulator build.
- `expo-sdk-upgrade` - moving the whole repo to a new Expo SDK or Xcode.
- `pocket-arcade-index` - the build order after the bootstrap.
