# E01 · Repo foundation and quality gates

| | |
|---|---|
| Branch | `epic/e01-repo-foundation` |
| Depends on | nothing |
| Spec | sections 0, 1.1, 2.2, 11 (game.config.ts, the app ids), 14 and 16 (D1 pilot Line Siege, D6 names: `@e07` stays a placeholder scope); N2 (banned packages), N4 (one game = one app); groundwork for definition-of-done item 15.8 (`npm run new-game` works from day one); owner decisions O4 (app ids) and O6 (owner reviews never block) and lead decision L14 (owner placeholders fail every ship gate) from docs/99-final-decisions.md section H |
| Build order | Shell step 1 (pocket-arcade-index, build-orders.md, "The Shell with the pilot game" and "What each Shell step copies, installs and generates", Step 1) |
| Tasks | 9 |

## Current state

The repository holds only knowledge, no code:

- Root entries: `docs/` (handbook 00-18 and 99-final-decisions), `design/` (the Toybox mockup), `skills/` (45 skills plus `_library/`), `epics/` (these plan files), `idea-hunt/` (its `tools/` folder has its own `package.json` and an untracked `node_modules/`), `spec.txt` (draft 3), `idea-hunt-prompt.md`, `50-apps-challenge-slides.html`, `README.md`, `LICENSE` and `.gitignore`.
- `.claude/` holds `settings.json` (only `$schema`, `skillListingBudgetFraction: 0.04` and three allow rules for skill scripts; no deny rule, ask rule or hook), `skills/` (one tracked link per skill) and a gitignored `workflows/`.
- `.gitignore` already holds every line of the bootstrap template plus `.claude/workflows/`.
- git: branch `main` tracks `origin` (github.com:zakariaf/pocket-arcade); the last commit on 2026-10-01 was `47caa86`.
- Toolchain checked on this Mac on 2026-10-01: Node v26.4.0, npm 11.17.0, git 2.50.1, `/Applications/Xcode-26.6.0.app` (`xcodebuild -version` through `DEVELOPER_DIR`: Xcode 26.6, build 17F113) next to `/Applications/Xcode.app` (Xcode 27, never used), CocoaPods 1.15.2 under the mise Ruby 3.2.2. `df -h /` showed about 24 GiB free.
- The generator's dry run on 2026-10-01 planned 91 new files, 1 merge (`.claude/settings.json`), 1 unchanged file (`.gitignore`) and 0 conflicts, with the dated `.npmrc` block included. It listed these pre-existing entries for the ignore lists: `50-apps-challenge-slides.html, LICENSE, README.md, design, docs, epics, idea-hunt, idea-hunt-prompt.md, spec.txt`.

What does not exist yet: no `package.json`, no lockfile, no workspace (`apps/`, `packages/`), no pilot app, no `AGENTS.md` or `CLAUDE.md`, no git hooks, no Claude Code hooks, no `shell-slice.json`. Nothing can be built or tested. The checkers show it: `check-monorepo.mjs .` stops with `ERROR [bad-input] nothing to check: . has no package.json`, `check-gate-wiring.mjs .` stops with `no package.json ... this is not the repo root`, and `check-game-app.mjs . --app line-siege --stage scaffold` fails with `[app-file-missing] the app folder does not exist`. Only `check-spec-refs.mjs .` passes, because it checks the spec citations in the knowledge files.

## What we will do

- Generate the whole monorepo with monorepo-bootstrap's `scaffold-monorepo.mjs`: the root configs, `packages/game-kit`, `packages/shell` (with the phase-0 config composer), `packages/tooling` (the gate scripts, the dependency check, the licence audit and the `new-game` forwarder), and `apps/line-siege` as Line Siege v1 with the fixed app id `io.applander.linesiege` and the Premium id `io.applander.linesiege.premium`. No config is typed by hand.
- Leave every knowledge folder where it is. The generator adds each one to `.prettierignore` and to `PRE_EXISTING` in `eslint.config.mjs`. It merges `.gitignore` and `.claude/settings.json` and never replaces them.
- Write `shell-slice.json` as `{ "screens": [], "why": "Shell build in progress: no Shell app yet" }`, because no Shell screen exists yet.
- Install exactly the verified Expo SDK 57 set from the generated manifests. Review and approve each install script one at a time, and commit the lockfile.
- Wire and prove every gate that exists at Shell step 1: lefthook (pre-commit, commit-msg, pre-push), the Claude Code hooks (after every edit, and on Stop), the guardrail, `check:fast`, coverage, knip and the dependency gate. Also run every checker of the skills this step names. Each gate is seen rejecting a bad input once.
- Prove the pilot passes the new-game scaffold check, that its Expo config resolves for test/test, test/off and store/off and refuses the forbidden pairs, and that `npm run new-game -- --help` works.
- Land everything as one first commit through the hooks, with the trailer `Gate-Change: initial quality gates`. Then write a plain-English report that names the pending gates, the `.npmrc` expiry date and the owner steps.
- TDD rule for copied templates (it applies in every epic): first run the owning skill's checker and watch it fail (the red names the missing files). Every template brings its test in the same write. Any code written beyond a template follows strict red-green-refactor (tdd-workflow). E01 writes no product code by hand.

Not in this epic:
- Game-kit contract, RNG, dates and fast-check: E02 (Shell step 2).
- Line Siege rules, bots, sims and level packs (`npm run test:sim` turns green): E03.
- The tool scripts behind `i18n:verify` (E06), `audit:network`, `audit:privacy`, `audit:licenses`' bundle export and `build:ios:sim` (E10), `e2e:ios` and `screenshots:ios` (E16), `release:ios` (E17). They are never stubbed.
- The final `with-shell.ts`, `shell-plugins.ts`, the 3-line `index.ts` entry and the first prebuild: E09 and E10.
- Any screen, and therefore any Toybox design match: from E09 (the S1 splash) and E11 onwards.
- Pushing to `origin`: it needs the owner's word, and the pre-push hook runs `npm run verify`, which cannot be green before E10 (see "How we work in this epic").
- Store pages and publishing (pipeline steps 8 and 9).

## Final state

- [ ] The tree matches the templates: `node skills/monorepo-bootstrap/scripts/check-monorepo.mjs .` prints `RESULT: PASS`, with exactly seven `pending` lines (i18n:verify, audit:network, audit:privacy, e2e:ios, screenshots:ios, build:ios:sim, release:ios).
- [ ] Every gate is wired: `node skills/quality-gates/scripts/check-gate-wiring.mjs .` prints `RESULT: PASS` with exactly seven not-yet-due SKIP lines: `npm run i18n:verify` (due at Shell step 6), `audit:network`, `audit:privacy` and `build:ios:sim` (step 8), `e2e:ios` and `screenshots:ios` (step 10) and `release:ios` (step 11). It also prints the note `shell-slice.json declares a partial Shell (no Shell app)`.
- [ ] One locked tree: after `npm ci` from the committed `package-lock.json`, `npm ls react react-native @typescript-eslint/eslint-plugin` shows one version each (19.2.3, 0.86.3, 8.70.1). `npm approve-scripts --allow-scripts-pending` prints `No packages with unreviewed install scripts.` `node skills/dependency-management/scripts/check-deps-policy.mjs .` prints `RESULT: PASS`.
- [ ] The fast gate and the full checks are green: `npm run -s check:fast`, `npm run -s lint`, `npm run -s typecheck`, `npm run -s test:coverage` (every suite passes and the thresholds are met: global 90/90/90/85), `npm run -s knip` (configuration hints only), `node packages/tooling/src/quality/check-quality-gates.ts` (`all resolved configs match quality-gates.json`) and `EXPO_NO_TELEMETRY=1 node packages/tooling/src/deps/check-deps.ts` (exit 0; a dated WARN for an Expo patch is allowed until its due date). `npx lefthook validate` prints `All good`.
- [ ] `npm run verify` passes format:check, lint and typecheck, then stops at `i18n:verify`. That is expected until E06 and is named in the report.
- [ ] The skills' checkers pass: `check-bypasses.mjs .`, `check-configs.mjs .`, `check-source.mjs .`, `check-layout.mjs .`, `check-boundaries.mjs .`, `check-file-names.mjs .`, `check-code-names.mjs .`, `check-test-code.mjs .`, `check-tests.mjs .`, `check-known-pitfalls.mjs .` and `check-spec-refs.mjs .` each print `RESULT: PASS`. `check-test-setup.mjs .` prints exactly three expected `[test-dep-missing]` lines (`@testing-library/react-native`, `test-renderer`, `fast-check`), which E02 and E05 close.
- [ ] The pilot is a complete scaffold: `node skills/new-game-scaffold/scripts/check-game-app.mjs . --app line-siege --stage scaffold` prints `RESULT: PASS`. `node skills/new-game-scaffold/scripts/scaffold-game.mjs --app line-siege` prints `would write 0 new files`.
- [ ] The Expo config resolves for test/test, test/off and store/off with `io.applander.linesiege`, no `null` in `extra` and no `extra.adUnits`. `APP_VARIANT=store` without `EXPO_PUBLIC_APP_VARIANT` fails with `EXPO_PUBLIC_APP_VARIANT=test must equal APP_VARIANT=store`. The outputs are saved in `reports/`.
- [ ] `npm run new-game -- --help` prints `Usage: node scaffold-game.mjs --app <game-id> ...`.
- [ ] `shell-slice.json` is `{ "screens": [], "why": "Shell build in progress: no Shell app yet" }`.
- [ ] History is clean: `node skills/git-commits-and-reporting/scripts/check-commits.mjs . --range main..epic/e01-repo-foundation` and `node skills/tdd-workflow/scripts/check-test-edits.mjs . --range main..epic/e01-repo-foundation` print `RESULT: PASS` before the merge. The first commit `chore(repo): scaffold the monorepo and its gates` carries `Gate-Change: initial quality gates`.
- [ ] The dated `.npmrc` block is handled: it was not needed, or it was deleted on or after 2026-10-03, or its expiry date is in the report (T08).
- [ ] The evidence report passes: `node skills/git-commits-and-reporting/scripts/check-report.mjs reports/evidence-<YYYY-MM-DD>-e01-repo-foundation.md --kind slice` prints `RESULT: PASS`.
- [ ] `/simplify` and `/code-review` ran over the branch, and every finding is fixed, refused with a reason, or recorded (T09). The branch is merged into local `main` with `--no-ff` and deleted. Nothing was pushed without the owner's word.

## Skills to load

Always: `pocket-arcade-index`, `tdd-workflow`, `quality-gates`, `git-commits-and-reporting`.

For this epic:
- `pocket-arcade-product-spec`: `spec-lookup.mjs` prints the spec lines this epic serves (0, 1.1, 2.2, 11, 14, N2, N4, D1, D6); `check-spec-refs.mjs` checks every spec citation and that `apps/line-siege` is a catalogue game.
- `monorepo-bootstrap`: the generator `scaffold-monorepo.mjs`, the checker `check-monorepo.mjs`, the toolchain checks, the install and gate-run reference, the first-commit file list and the bootstrap report example.
- `dependency-management`: `check-deps-policy.mjs`, reviewing and approving install scripts, the dated `.npmrc` block and its expiry, and the Expo patch WARN.
- `typescript-and-lint-rules`: `check-configs.mjs` and `check-source.mjs`; fixing any tsc or ESLint error at its cause.
- `architecture-and-boundaries`: `check-layout.mjs` and `check-boundaries.mjs`; the phase-0 composer (`with-shell.ts`, `ads-config.ts`) and the build variants.
- `unit-and-component-tests`: `check-test-setup.mjs` (with its three expected lines), `check-test-code.mjs`, the Jest projects and the coverage policy.
- `naming-conventions`: `check-file-names.mjs` and `check-code-names.mjs`; the app id, commit and branch names.
- `new-game-scaffold`: `check-game-app.mjs --stage scaffold`, the `scaffold-game.mjs` plan over the pilot, and the `npm run new-game` forwarder.
- `troubleshooting-playbook`: `find-fix.mjs --text "<first error line>"` for any failure, and `check-known-pitfalls.mjs`.
- `skill-maintenance`: only if T09 confirms a finding inside a synced template (the fix goes into the skill library first).

## How we work in this epic

1. Branch: `git switch main && git pull && git switch -c epic/e01-repo-foundation`. The `epic/` prefix is this plan's branch form for an epic; naming-conventions' `<type>/<scope>-<slug>` form is for single-change branches, and no gate checks branch names. **No push in this epic.** Pushing needs the owner's word (git-commits-and-reporting rule 5). The pre-push hook that T04 installs runs `npm run verify`, which stops at `i18n:verify` until E06 and at `audit:network` until E10. Never bypass it (`--no-verify` is denied in `.claude/settings.json`). Commits stay local until the owner asks for a push and verify can pass.
2. Test first, always. Write each task's "Tests first" items, run them and watch them fail for the right reason, write the minimum code to pass, then refactor. Never weaken or edit a test to make it pass. In this epic most "tests first" items are a checker's red output or a gate seen rejecting a bad input. Keep every red output in `reports/` (gitignored) for the report.
3. Commit in Conventional Commits form, with the trailers the skills ask for (`Gate-Change:`, `Spec-Change:`). `npm run -s check:fast` must be green before every commit. In this epic, T01 to T06 build one skeleton, and it becomes a single first commit in T07, as monorepo-bootstrap's workflow step 10 says: before T04 there is no lockfile and no hook, so nothing earlier can be committed through the gates. T08 and T09 commit on their own.
4. Screens: E01 builds no screen, so no task has a design match. From the first screen on, a task that builds or changes a screen is not done until the app's capture matches the Toybox design screenshot for every frame it names, in light-en, light-fa, dark-en and dark-fa at every scroll offset, and check-signoff passes for those frames.
5. Stop and ask the owner only at a step marked **Owner**. Then send one message, built from git-commits-and-reporting's `templates/owner-request.md` and checked with `check-report.mjs <file> --kind request`, with the default that applies meanwhile, and keep working. From T03 on, Claude Code's Stop hook runs `npm run -s check:fast`, which cannot pass before T04's install. So do T03 to T05 in one sitting, and never answer a failing hook by editing it.

## Tasks

### E01-T01 · Check the toolchain and ask for missing human steps
- **Goal:** Confirm the Mac has the verified toolchain before anything is generated or installed, so a missing tool is found now and not halfway through the install. Ask the owner once for any human step that is missing. No product code.
- **Skills:** `monorepo-bootstrap` (references/toolchain-setup.md, "Checks to run before installing"), `git-commits-and-reporting` (references/stop-and-ask.md, templates/owner-request.md), `tdd-workflow` (workflow step 0: start from a known state), `troubleshooting-playbook` (if a check fails).
- **Tests first:** No code in this task. The checks below are the evidence: save their output in `reports/e01-toolchain.txt` (create `reports/` first; it is already gitignored).
- **Build:**
  1. `git status --short` and `git log --oneline -5` on `main`. Never discard work you did not make: uncommitted owner work (for example `epics/`, if the owner has not committed it yet) stays untouched and stays out of every E01 commit. Note `git rev-parse --short HEAD` as `<base>`.
  2. Run and record: `node --version` (v26.4.0), `npm --version` (11.17.0; `engine-strict` refuses older), `git rev-parse --is-inside-work-tree` (true; lefthook installs only inside git), `DEVELOPER_DIR=/Applications/Xcode-26.6.0.app/Contents/Developer xcodebuild -version` (Xcode 26.6, 17F113), `pod --version` (1.17.0 or 1.15.2, both verified; needed only from the first prebuild in E10), `mise --version`, and `df -h /`.
  3. Never run `sudo` or `xcode-select`, and never use `/Applications/Xcode.app` (Xcode 27 needs scene support first; that is a later SDK move, not part of this epic).
  4. If free space is under the 60 GB that toolchain-setup asks for, name it in the report: the bootstrap does not need it, but the simulator builds in E10 do.
- **Done when:** `reports/e01-toolchain.txt` shows the expected values above, or each missing item has been asked for once with its default.
- **Owner:** Only if a check fails. Human step O4 of the stop-and-ask list is "install Xcode 26.6 and accept its licence with `sudo`" (not owner decision O4, the app ids). The other possible step is trusting the project folder in Claude Code (toolchain-setup, owner step 4), because project permission rules are dropped in an untrusted folder. The default meanwhile: Claude continues with T02 to T07, because the files, the install, the gates, `expo config` and `expo export` need neither Xcode nor CocoaPods.

### E01-T02 · Plan the scaffold and resolve conflicts
- **Goal:** Know exactly what the generator will create, merge and ignore before any file is written, and keep the red output that the scaffold must turn green.
- **Skills:** `monorepo-bootstrap` (references/repo-layout.md, references/root-files.md "Merging an existing repo (conflicts)"), `pocket-arcade-product-spec`, `new-game-scaffold`, `naming-conventions`.
- **Tests first:** Run these on the docs-only repo and save the output in `reports/e01-red.txt`:
  1. `node skills/monorepo-bootstrap/scripts/scaffold-monorepo.mjs --root . --app line-siege --name "Line Siege" --compare` prints `RESULT: FAIL`, with one `[differs] is missing` line per file (92 problems on 2026-10-01: the missing files plus the unmerged `.claude/settings.json`).
  2. `node skills/monorepo-bootstrap/scripts/check-monorepo.mjs .` stops with `ERROR [bad-input] nothing to check: . has no package.json` (exit 2: this is the red, never a pass).
  3. `node skills/new-game-scaffold/scripts/check-game-app.mjs . --app line-siege --stage scaffold` prints `FAIL apps/line-siege [app-file-missing] the app folder does not exist`.
- **Build:**
  1. Create the branch (How we work, item 1).
  2. Print the spec lines this epic serves, for the commit body and the report: `node skills/pocket-arcade-product-spec/scripts/spec-lookup.mjs 0 1.1 2.2 11 14 N2 N4 D1 D6`. Quote them from this output, never from memory.
  3. Read monorepo-bootstrap's references/repo-layout.md (the tree, the phase-0 files, pre-existing folders) and references/root-files.md.
  4. Dry run (writes nothing): `node skills/monorepo-bootstrap/scripts/scaffold-monorepo.mjs --root . --app line-siege --name "Line Siege"`. Expected: `pilot app: apps/line-siege ("Line Siege", io.applander.linesiege)`, the release-age block `included` (up to and including 2026-10-03) or `not needed` (from 2026-10-04), the pre-existing list from "Current state", `91 new, 1 merged, 0 replaced, 1 unchanged, 0 conflicts` and `RESULT: PASS`.
  5. Check the pre-existing list. Every knowledge entry must be in it. `skills/` and `.claude/` are not in it, because the templates already ignore them in every tool. If a new top-level entry has appeared since 2026-10-01, decide its place first: a layout folder, or the ignore lists. A folder added after the bootstrap needs a `Gate-Change:` trailer.
  6. Names. The bundle id has no option: `io.applander.linesiege` is fixed (owner decision O4), and `--bundle-id` with any other value stops with exit 2. Pass `--name-fa` and `--name-ckb` only if the owner has given Persian or Sorani store names. Otherwise the Latin "Line Siege" stays in all four languages, as the canonical catalogs' `line-siege.name` does. The owner confirms the name at step G1 and reviews the fa and ckb texts personally (owner decision O6). That review never blocks.
  7. Conflicts. There were none on 2026-10-01. If one appears, resolve it as root-files.md says: edit the file to the template content, or rerun with `--replace <file>` when the existing file is an old draft. `.gitignore` and `.claude/settings.json` are always merged, never replaced. The current settings file has no deny rule, ask rule or hook, so the merge keeps its three allow rules and adds the template's plugin entry, deny and ask rules and two hooks. If a merge would drop an existing deny rule, ask rule or hook, that is a question for the owner.
- **Done when:** The dry run prints `0 conflicts` and `RESULT: PASS`, and `reports/e01-red.txt` holds the three red outputs.
- **Owner:** Only if the dry run reports a conflict in `.claude/settings.json` that would drop an existing rule (one request; default: keep the owner's rule and stop the bootstrap at this step).

### E01-T03 · Write the skeleton, the pilot app files and shell-slice.json
- **Goal:** The monorepo exists on disk exactly as the templates define it. The pilot already passes the new-game scaffold check, and `shell-slice.json` says honestly that no Shell screen exists yet.
- **Skills:** `monorepo-bootstrap`, `new-game-scaffold`, `architecture-and-boundaries` (the phase-0 composer and the variants), `quality-gates` (`shell-slice.json` and the hooks it wires).
- **Tests first:** T02's red must turn green with no hand edit. The 15 template test files arrive in the same write, next to their modules, and run in T05 once the packages are installed:
  - `packages/game-kit/src/contract/result.test.ts`
  - `packages/shell/src/config/app-variant.test.ts`, `with-shell.test.ts`
  - `packages/shell/src/i18n/intl-status.test.ts`
  - `packages/tooling/src/audit/license-policy.test.ts`
  - `packages/tooling/src/clock/system-clock.test.ts`
  - `packages/tooling/src/deps/app-lockstep.test.ts`, `banned-packages.test.ts`, `expo-patch-age.test.ts`, `release-age-excludes.test.ts`
  - `packages/tooling/src/git/commit-message-rules.test.ts`
  - `packages/tooling/src/quality/device-only.test.ts`, `gate-diff.test.ts`, `shell-slice.test.ts`, `verify-plan.test.ts`

  `shell-slice.json` is data, not code. Its reader is tested by `shell-slice.test.ts`, and its proof is the wiring check's note below.
- **Build:**
  1. Write the files: `node skills/monorepo-bootstrap/scripts/scaffold-monorepo.mjs --root . --app line-siege --name "Line Siege" --write`, with the same name flags as the T02 plan. Expected: `written: 91 new, 1 merged, ...`. This is build-order Step 1's whole copy manifest (`**` and `apps/__GAME_ID__/**` of monorepo-bootstrap). The generated files include `AGENTS.md`, `CLAUDE.md`, `eslint.config.mjs` (with `PRE_EXISTING`), the merged `.claude/settings.json`, `packages/tooling/license-exceptions.json`, the pilot's fonts and its four catalogs.
  2. Rerun the dry run without `--write`, before any formatting. It must print `0 new, 0 merged` and `RESULT: PASS`.
  3. Write `shell-slice.json` at the root with exactly `{ "screens": [], "why": "Shell build in progress: no Shell app yet" }`. The generator does not write it; the build order ("A partial Shell") puts it at step 1. It becomes `["S1"]` when Shell step 7 adds the splash and the navigator, gains one id per screen in Shell step 9, and is deleted at Shell step 10 (E16).
  4. Read and confirm what was written:
     - Root: `package.json` (workspaces `apps/*` and `packages/*`, the canonical scripts, `overrides` for react, react-native, the ten `@typescript-eslint/*` packages and the Shell's native peers), `.npmrc` (`min-release-age=7`, `engine-strict=true`, `save-exact=true`, plus the dated `# exclude-block expires=2026-10-03` block only when the plan said `included`), `.nvmrc`, `.mise.toml`, `tsconfig*.json`, `eslint.config.mjs`, `.prettierrc.json`, `.prettierignore`, `knip.json` (`"ignore": ["skills/**"]`), `lefthook.yml`, `quality-gates.json`, `babel.config.js`, `jest.config.js`, `jest.setup.ts`, `jest.sim.config.js`, `stryker.config.json`, `AGENTS.md` and `CLAUDE.md`.
     - `packages/shell`: `src/app-env.d.ts`; `src/config/` with `game-config.ts`, `app-variant.ts`, `game-extra.ts` and the phase-0 `with-shell.ts` and `ads-config.ts` (E10 replaces both); `src/i18n/intl-polyfills.ts` and `intl-status.ts`; `plugins/with-app-variant-marker.ts`.
     - `packages/tooling/src/`: `quality/` (guardrail, verify runner and plan, slice reader, device-only helper), `deps/`, `clock/`, `audit/` (the licence audit), `git/` (the commit-msg check), `hooks/after-edit.ts` and `scaffold/new-game.ts`.
     - `apps/line-siege`: `package.json` (the minimal runtime set: expo, react, react-native, expo-system-ui, Skia, Gesture Handler, Reanimated, Worklets, `@e07/shell`), `tsconfig.json`, `metro.config.js` (`cacheVersion` keyed on `EXPO_PUBLIC_APP_VARIANT`), `.gitignore`, `app.config.ts` (the one statement `export default withShell(gameConfig, process.env);`), the placeholder `index.ts` (until the Shell boot), `assets/fonts/` (five TTF files and three OFL texts) and `src/i18n/en.json`, `de.json`, `fa.json`, `ckb.json` (the canonical catalogs, copied, never rendered).
     - `apps/line-siege/game.config.ts`: id `line-siege`; `bundleId` `io.applander.linesiege`; `premium.productId` `io.applander.linesiege.premium`; `modes` daily and endless on; 3 packs of 30 levels; `hints.freePerDay: 0` (no hints); `isContinueAllowed: true` (one continue); `violenceCartoonOrFantasy: 'INFREQUENT_OR_MILD'`. It also holds the scaffold placeholders: the AdMob ids `ca-app-pub-1234567890123456~1234567890` and units `/1111111111`, `/2222222222`, `/3333333333` (owner step G5), and `example.com` and `support@example.com` (owner step G3). Leave every placeholder as it is: under lead decision L14, every ship gate fails on each one by name until the owner supplies the real value. The scaffold stage passes.
  5. The merged `.claude/settings.json` adds the PostToolUse hook (`after-edit.ts` formats and lints each edited file) and the Stop hook (`npm run -s check:fast`). Go straight on to T04.
- **Done when:**
  1. The dry run prints `0 new, 0 merged` and `RESULT: PASS`.
  2. `node skills/new-game-scaffold/scripts/check-game-app.mjs . --app line-siege --stage scaffold` prints `RESULT: PASS` (it needs no install).
  3. `node skills/quality-gates/scripts/check-gate-wiring.mjs .` prints `note: shell-slice.json declares a partial Shell (no Shell app)` and no `[shell-slice]` problem.
  4. `node skills/monorepo-bootstrap/scripts/check-monorepo.mjs .` now runs, and its only FAIL line is `package-lock.json [root-file] is missing` (T04 makes it).
- **Owner:** When the next Claude Code session starts, it may ask the owner to approve the new hooks, permission rules and the Expo plugin entry in `.claude/settings.json` (human step O6 of the stop-and-ask list). Claude carries on with T04 meanwhile.

### E01-T04 · Install the pinned set and approve install scripts
- **Goal:** One locked, reviewed dependency tree: exactly the verified SDK 57 set, one React, one React Native, one typescript-eslint, and no install script that nobody read.
- **Skills:** `dependency-management` (rules 4 to 7, references/supply-chain.md, references/release-age-policy.md), `monorepo-bootstrap` (references/first-install-and-verify.md, "Install and approve install scripts"), `troubleshooting-playbook`.
- **Tests first:**
  1. Before installing, `node skills/dependency-management/scripts/check-deps-policy.mjs .` prints `FAIL package-lock.json [lockfile-missing]`, and `check-monorepo.mjs .` prints `FAIL package-lock.json [root-file] is missing`.
  2. After `npm install` and before any approval, both checkers fail on their `install-scripts` rule for the pending packages. That red proves the approval gate bites.
- **Build:**
  1. `mise trust && mise install` at the root (Node 26.4.0 with npm 11.17.0 and Ruby 3.2.2, from the new `.mise.toml`).
  2. `npm install`. It writes `package-lock.json`, and `prepare` runs `lefthook install` (`sync hooks: ✔️(commit-msg, pre-commit, pre-push)`). Expected noise: `npm warn deprecated` lines from pinned tools (ESLint 9 is held back on purpose), and "N moderate severity vulnerabilities", all in build tooling. Note the count for the report and never run `npm audit fix` (its `--force` moves expo off SDK 57).
  3. `npm approve-scripts --allow-scripts-pending` lists what is pending. For each package, read the script first (`npm view <pkg>@<version> scripts`), then approve that one package. The reference names lefthook 2.1.14 (installs the hook runner binary), unrs-resolver 1.12.2 (picks the ESLint resolver binary) and @shopify/react-native-skia 2.6.2 (copies the iOS xcframeworks into `libs/`), plus fsevents 2.3.3 (a local node-gyp build) whenever an install lists it. So the commands are `npm approve-scripts lefthook`, `npm approve-scripts unrs-resolver` and `npm approve-scripts @shopify/react-native-skia`, one at a time and never `--all`.
  4. `npm approve-scripts --allow-scripts-pending` again. It must print `No packages with unreviewed install scripts.` (It exits 0 either way, so read the output.)
  5. `npm ls react react-native @typescript-eslint/eslint-plugin` shows one version each (19.2.3, 0.86.3, 8.70.1).
  6. On `ETARGET` or `notarget` (a version younger than 7 days), never delete the lockfile and never loosen `.npmrc`; follow release-age-policy.md. On any other error, run `node skills/troubleshooting-playbook/scripts/find-fix.mjs --text "<first error line>"` first.
- **Done when:** `node skills/dependency-management/scripts/check-deps-policy.mjs .` prints `RESULT: PASS`; the approve-scripts output and the `npm ls` output are saved in `reports/e01-install.txt`; `package-lock.json` exists (it is committed in T07).

### E01-T05 · Wire and prove every gate
- **Goal:** Every gate that exists at Shell step 1 runs green. Each kind of gate is also seen rejecting a bad input once, so we know it is really wired and not just silent.
- **Skills:** `quality-gates`, `typescript-and-lint-rules`, `architecture-and-boundaries`, `naming-conventions`, `unit-and-component-tests`, `tdd-workflow`, `dependency-management`, `troubleshooting-playbook`.
- **Tests first:**
  1. The 15 template test files from T03 are this task's tests. The first `npm run -s test:coverage` must pass every one. A red test here is a real failure (a wrong install or a broken template): look it up with `find-fix.mjs` and never edit the test.
  2. The commit-msg gate bites: `printf 'Updated stuff.\n' > reports/bad-commit-message.txt`, then `node packages/tooling/src/git/check-commit-message.ts reports/bad-commit-message.txt` exits non-zero, and `node skills/git-commits-and-reporting/scripts/check-commits.mjs . --message reports/bad-commit-message.txt` prints FAIL lines for the same message.
  3. The edit hook bites. Write a scratch file `packages/game-kit/src/contract/probe-random.ts` holding `export const roll = (): number => Math.random();`. Then `echo "{\"tool_input\":{\"file_path\":\"$PWD/packages/game-kit/src/contract/probe-random.ts\"}}" | node packages/tooling/src/hooks/after-edit.ts` must exit 2 and name the problem on stderr. Delete the probe afterwards; it is never committed.
- **Build:** Run in this order, saving each output in `reports/e01-gates/<name>.txt` for the report:
  1. `npx prettier --list-different .` shows what formatting would change: only the merged `.claude/settings.json`, or nothing. Any other generated file in that list is a template bug, handled like a T09 finding. Then run `npm run format` once.
  2. `npx lefthook install`, then `npx lefthook validate` must print `All good`.
  3. The guardrail: `node packages/tooling/src/quality/check-quality-gates.ts` prints `all resolved configs match quality-gates.json`.
  4. `node skills/quality-gates/scripts/check-gate-wiring.mjs .` prints `RESULT: PASS` with exactly the seven not-yet-due SKIP lines from "Final state". `node skills/quality-gates/scripts/check-bypasses.mjs .` prints `RESULT: PASS`.
  5. `node skills/typescript-and-lint-rules/scripts/check-configs.mjs .` and `node skills/typescript-and-lint-rules/scripts/check-source.mjs .` print `RESULT: PASS`.
  6. `node skills/architecture-and-boundaries/scripts/check-layout.mjs .` prints `RESULT: PASS` with the note that `apps/line-siege/index.ts and src/index.ts are not checked yet (packages/shell/src/app/start-shell.ts does not exist)`. `node skills/architecture-and-boundaries/scripts/check-boundaries.mjs .` prints `RESULT: PASS`.
  7. `node skills/naming-conventions/scripts/check-file-names.mjs .` and `node skills/naming-conventions/scripts/check-code-names.mjs .` print `RESULT: PASS`.
  8. `node skills/unit-and-component-tests/scripts/check-test-code.mjs .` and `node skills/tdd-workflow/scripts/check-tests.mjs .` print `RESULT: PASS`.
  9. `node skills/unit-and-component-tests/scripts/check-test-setup.mjs .` prints exactly three FAIL lines, `[test-dep-missing] devDependencies lack @testing-library/react-native`, `... test-renderer` and `... fast-check`, then `RESULT: FAIL (3 problems)`. That is expected at Shell step 1: fast-check arrives in E02 (`plan-dependency.mjs fast-check`), and the RNTL pair arrives in E05. Installing them now would fail knip on unused dependencies (monorepo-bootstrap rule 5). Any other line is a real failure.
  10. `npm run -s check:fast` is green. The first Jest run takes about 40 s with a cold cache.
  11. `npm run -s lint` and `npm run -s typecheck` (the root, the three packages and the app) pass.
  12. `npm run -s test:coverage` passes with the thresholds in `jest.config.js` met (global 90 statements, 90 lines, 90 functions, 85 branches; 95/95/95/90 for a logic folder once it has code). Note the suites, the tests and the random seed. `npx jest --ci --selectProjects golden` finds no tests yet, so the golden count is 0.
  13. `npm run -s knip` shows configuration hints only and no issues.
  14. `EXPO_NO_TELEMETRY=1 node packages/tooling/src/deps/check-deps.ts` exits 0. It needs the network: `expo install --check` must say up to date, and `expo-doctor` must pass all its checks. A `WARN` line for an Expo patch younger than 7 days is not a failure: copy its due date into the report (`expo` 57.0.26, published 2026-09-29, is due on 2026-10-07). From the due date on, the mismatch fails. Then move the package with dependency-management's upgrade procedure (references/procedures.md: the app pin, the versions-table row and the root override, `npm install`) in its own `chore(deps)` commit after T07.
  15. `node skills/troubleshooting-playbook/scripts/check-known-pitfalls.mjs .` prints `RESULT: PASS`.
  16. `npm run verify` passes format:check, lint and typecheck, then stops at `i18n:verify` (`verify: step "i18n:verify" failed ...; later steps did not run`). That is expected until E06. Never stub `verify-catalogs.ts` or `audit-network.ts`. The later verify steps that exist (knip, the guardrail, test:coverage, check-deps) ran on their own above. `test:sim` (E03), `audit:network` and `audit:licenses` (E10) are pending.

  Fix a failing gate in the files, never in the gate: no lowered limit, no ignore comment, no edit to `quality-gates.json`. The generated files are byte-for-byte template copies, so a failure inside one is handled by T09's rule (b). If a gate itself looks wrong, send the owner quality-gates' `templates/gate-question.md` and change nothing.
- **Done when:** Every command above prints the stated result, the two biting tests were seen red, the probe file is deleted, and `git status --short` shows no stray scratch files outside `reports/`.

### E01-T06 · Prove the pilot scaffold, the Expo variants and the new-game generator
- **Goal:** Line Siege v1 passes the new-game checks from the very start, so every later game is compared with it. Its Expo config resolves for every allowed build variant and refuses the forbidden ones (N4: its own app id). Game 2 can start with `npm run new-game`.
- **Skills:** `new-game-scaffold`, `architecture-and-boundaries` (the phase-0 `withShell` and the `APP_VARIANT`/`ADS_MODE` rules), `naming-conventions` (app ids), `pocket-arcade-product-spec` (`check-spec-refs.mjs`).
- **Tests first:** The forbidden variant pairs must fail before the allowed ones are trusted (`app-variant.test.ts` and `with-shell.test.ts` already passed in T05; these runs prove the wiring through the Expo CLI):
  1. `(cd apps/line-siege && env -u EXPO_PUBLIC_APP_VARIANT EXPO_NO_TELEMETRY=1 CI=1 APP_VARIANT=store ADS_MODE=off npx expo config --json)` exits non-zero with `EXPO_PUBLIC_APP_VARIANT=test must equal APP_VARIANT=store`.
  2. `(cd apps/line-siege && EXPO_NO_TELEMETRY=1 CI=1 APP_VARIANT=store EXPO_PUBLIC_APP_VARIANT=store ADS_MODE=test npx expo config --json)` exits non-zero with `ADS_MODE=test is not allowed when APP_VARIANT=store`.
- **Build:**
  1. `node skills/new-game-scaffold/scripts/check-game-app.mjs . --app line-siege --stage scaffold` prints `RESULT: PASS` with no file moved.
  2. `node skills/new-game-scaffold/scripts/scaffold-game.mjs --app line-siege` (a plan; it writes nothing) prints `would write 0 new files for line-siege` and `RESULT: PASS`: the two skills write identical bytes. Never run `--write` over the pilot.
  3. The three allowed variants, each saved to `reports/e01-expo-config-<variant>.json`:
     - `(cd apps/line-siege && EXPO_NO_TELEMETRY=1 CI=1 APP_VARIANT=test EXPO_PUBLIC_APP_VARIANT=test ADS_MODE=test npx expo config --json)`
     - the same with `ADS_MODE=off`
     - `APP_VARIANT=store EXPO_PUBLIC_APP_VARIANT=store ADS_MODE=off`

     In each one, check: `ios.bundleIdentifier` and `android.package` are `io.applander.linesiege`; `scheme` is `e07-line-siege` in the two test variants only; `extra.appVariant` and `extra.adsMode` are as set; there is no `extra.adUnits` key (it appears only with `ADS_MODE=live`); there is no `null` anywhere in `extra`; `updates.enabled` is false; `experiments.reactCompiler` is true; the plugin list holds `@e07/shell/plugins/with-app-variant-marker.ts`.
  4. `(cd apps/line-siege && EXPO_NO_TELEMETRY=1 CI=1 APP_VARIANT=test EXPO_PUBLIC_APP_VARIANT=test ADS_MODE=off npx expo config --type introspect --json)` shows `ios.infoPlist.E07AppVariant` = `test` and `ITSAppUsesNonExemptEncryption` = false.
  5. `(cd apps/line-siege && EXPO_NO_TELEMETRY=1 CI=1 APP_VARIANT=test EXPO_PUBLIC_APP_VARIANT=test ADS_MODE=off npx expo export --platform ios --output-dir "$(mktemp -d)")` bundles the placeholder entry. This proves that Metro, the React Compiler and the workspace links work with `skills/` present.
  6. `npm run new-game -- --help` prints the generator's usage (`Usage: node scaffold-game.mjs --app <game-id> ...`).
  7. `node skills/pocket-arcade-product-spec/scripts/check-spec-refs.mjs .` prints `RESULT: PASS`: `apps/line-siege` is a catalogue game, and every spec ID cited in the new files and the knowledge files exists. A FAIL inside `docs/` or `epics/` is fixed in that file, in its own `docs(docs)` commit.
- **Done when:** The two forbidden pairs failed with the quoted messages, and each of steps 1 to 7 printed its stated result. The outputs are in `reports/`.

### E01-T07 · First commit through the hooks, and the bootstrap report
- **Goal:** The skeleton lands as one commit that passed every hook, holding only the generator's files and `shell-slice.json`. The owner gets a short plain-English report of what exists and what is still pending.
- **Skills:** `git-commits-and-reporting` (references/commit-format.md, templates/commit-message.txt, templates/evidence-slice.md, references/owner-updates.md), `monorepo-bootstrap` (references/first-install-and-verify.md "The first commit", examples/bootstrap-report.md), `quality-gates` (the hooks), `tdd-workflow` (`check-test-edits.mjs`).
- **Tests first:**
  1. Write the message to `reports/commit-message.txt` from templates/commit-message.txt, first without the trailer. After staging (Build step 2), `node skills/git-commits-and-reporting/scripts/check-commits.mjs . --message reports/commit-message.txt --staged` must print `FAIL ... [gate-change-missing]`, because the staged files include gated paths.
  2. Add the trailer as the last paragraph and rerun. It must print `RESULT: PASS`.
- **Build:**
  1. `git status --short`. Anything that is neither the generator's output nor `shell-slice.json` (the owner's own changes, `epics/` if still uncommitted) stays out of this commit; name it in the report.
  2. Stage exactly these, never `git add -A`: `git add package.json package-lock.json .npmrc .nvmrc .mise.toml .gitignore .prettierrc.json .prettierignore tsconfig.base.json tsconfig.json tsconfig.stryker.json eslint.config.mjs knip.json lefthook.yml quality-gates.json .claude/settings.json AGENTS.md CLAUDE.md babel.config.js jest.config.js jest.setup.ts jest.sim.config.js stryker.config.json shell-slice.json apps packages`.
  3. The message: header `chore(repo): scaffold the monorepo and its gates`. The body says why in plain words: one npm-workspaces monorepo for the Shell, the game kit, the tooling and one app per game (spec 1.1, N4), with Line Siege v1 as the pilot (D1) and the fixed app id from owner decision O4. It names the gates still pending. The last paragraph is `Gate-Change: initial quality gates`.
  4. `git commit -F reports/commit-message.txt`. The pre-commit hook (no-secrets, format, lint, typecheck, related tests) and the commit-msg hook must pass. If a hook fails, fix the cause, restage and commit again. Never `--no-verify` (it is denied anyway).
  5. `node skills/git-commits-and-reporting/scripts/check-commits.mjs . --range main..HEAD` and `node skills/tdd-workflow/scripts/check-test-edits.mjs . --range main..HEAD` print `RESULT: PASS`.
  6. The report: copy git-commits-and-reporting's templates/evidence-slice.md to `reports/evidence-<YYYY-MM-DD>-e01-repo-foundation.md`. Fill it in the spirit of monorepo-bootstrap's examples/bootstrap-report.md, taking every number from a named `reports/` file:
     - the outcome in one plain sentence;
     - `Evidence: repo slice on <date>, commit <sha>`;
     - Checks: `Types, lint, format: pass`, and `Tests: <passed>/<total> pass (unit <n>, golden 0), random seed <seed>` from `reports/e01-gates/test-coverage.txt`;
     - what changed for players: nothing playable yet;
     - not complete yet, on purpose: `npm run verify` stops at the translation check until E06; the game simulations arrive in E03 and the network and licence audits in E10; the app shows an empty screen; check-test-setup's three expected lines;
     - the `.npmrc` block's expiry date (2026-10-03), if it was written;
     - npm's moderate-advisory count, as information;
     - Owner steps (not blocking): the fa and ckb texts (the pilot's four catalogs are drafts for the owner's review, step R3); the Line Siege play-test (step G6; nothing playable yet); the sound previews (step G9; none yet); the privacy-policy host and support address (step G3); and the AdMob ids (step G5). Each line says which gate it unblocks;
     - not tested or not verified: no prebuild and no simulator build (E10).
  7. `node skills/git-commits-and-reporting/scripts/check-report.mjs reports/evidence-<YYYY-MM-DD>-e01-repo-foundation.md --kind slice` prints `RESULT: PASS`.
- **Done when:** `git log -1` shows the commit with its `Gate-Change:` trailer, made through every hook; check-commits, check-test-edits and check-report print `RESULT: PASS`; nothing was pushed.

### E01-T08 · Delete the dated .npmrc block when it expires
- **Goal:** The bootstrap's release-age exception never outlives its date. Decision G.11 in docs/99-final-decisions.md and dependency-management rule 6 say: delete it on its date, never extend it. A glob exclude left open lets any new release in.
- **Skills:** `dependency-management` (release-age-policy.md, "Expiry: delete, never extend"), `monorepo-bootstrap`, `quality-gates` (`check-bypasses.mjs`), `git-commits-and-reporting`.
- **Tests first:** With the block still in `.npmrc`, the three checkers must fail once the date has passed. They count a block as expired from the day after its `expires=` date. Run `node skills/monorepo-bootstrap/scripts/check-monorepo.mjs . --today 2026-10-04`, `node skills/dependency-management/scripts/check-deps-policy.mjs . --today 2026-10-04` and `node skills/quality-gates/scripts/check-bypasses.mjs . --today 2026-10-04`. Each reports the expired excludes (rules `npmrc-exclude` and `release-age-exclude`). That is the red the deletion turns green.
- **Build:** Pick the case that applies:
  1. The T02 plan said `release-age block: not needed` (E01 began on or after 2026-10-04): there is nothing to delete. Confirm that `.npmrc` has no `exclude-block` line and write "not needed" in the report.
  2. Today is 2026-10-03 or later, and E01 is still open: delete the whole `# exclude-block expires=2026-10-03 ...` block from `.npmrc`, and nothing else. Never move its date. The lockfile keeps the installed versions, and `npm ci` still works. Then run `npm ci` and `npm run -s check:fast`. Commit only `.npmrc` as `chore(deps): delete the expired bootstrap release-age block`, with the trailer `Gate-Change: bootstrap release-age block expired on 2026-10-03`.
  3. E01 merges before 2026-10-03: put the date in the report. From 2026-10-04 on, the gates fail on their own (`check-deps.ts` in verify, check-deps-policy, check-monorepo and check-bypasses). The epic that is open then does case 2's steps as its next commit.
- **Done when:** In case 2, the three checkers without `--today`, and again with `--today 2026-10-04`, print `RESULT: PASS`, and `check-commits.mjs . --range main..HEAD` passes. In cases 1 and 3, the report says "not needed" or names the date.
- **Owner:** In case 2 only: editing `.npmrc` triggers Claude Code's ask prompt (it is a gated path), and the owner approves it. Claude carries on with T09 meanwhile.

### E01-T09 · Review the branch with /simplify and /code-review
- **Goal:** The epic's whole diff gets the two review passes the owner requires. Findings are handled without breaking the rule that generated files stay byte-for-byte copies of the verified templates.
- **Skills:** `tdd-workflow`, `quality-gates`, `monorepo-bootstrap`, `git-commits-and-reporting`, `troubleshooting-playbook`, and `skill-maintenance` (only for a confirmed finding in a synced template).
- **Tests first:** Every accepted finding first becomes something red that shows the problem: a failing Jest test for code, or a failing checker line for a config or data file (for example from `check-monorepo.mjs`, `check-gate-wiring.mjs` or `check-deps-policy.mjs`). Only then comes the fix.
- **Build:**
  1. Run `/simplify` over the branch's changes (`git diff main...HEAD`).
  2. Run `/code-review` on the branch.
  3. Sort every finding into one of three groups:
     - (a) In what this epic decided or wrote itself: `shell-slice.json`, the merge result in `.claude/settings.json`, the `.npmrc` handling, the commit and the report. Fix it test-first in its own commit (`fix(repo): ...` or `chore(repo): ...`). A gated path changes only with the owner's agreement and a `Gate-Change:` trailer.
     - (b) Inside a generated file. These are synced copies of the skill library's templates, and `check-monorepo.mjs`, `check-gate-wiring.mjs` (rules `gate-script-changed` and `npm-script`) and `scaffold-monorepo.mjs --compare` compare them with the templates. So the repo copy is never edited on its own. The fix goes into the library first (skill-maintenance: change the canonical copy under `skills/_library/shared/`, run `node skills/_library/sync-shared.mjs`, then the owning skill's self-test). After that, regenerate the file here with `node skills/monorepo-bootstrap/scripts/scaffold-monorepo.mjs --root . --app line-siege --name "Line Siege" --replace <file> --write`, in a commit that gives the reason. Because that changes the skills, ask the owner first.
     - (c) A finding that would weaken a gate (a lowered limit, an extra ignore, a skipped test). Refuse it (quality-gates rule 1) and list it in the report with the reason.
  4. After the fixes, rerun T05's commands, `npm run -s check:fast`, `node skills/git-commits-and-reporting/scripts/check-commits.mjs . --range main..HEAD` and `node skills/tdd-workflow/scripts/check-test-edits.mjs . --range main..HEAD`.
- **Done when:** Every finding is fixed (with its red run kept), refused with a reason, or raised to the owner as a library change. T05's gates are green again, and both history checks print `RESULT: PASS`.
- **Owner:** Only for a group (b) finding or a gate change. Send one request. The default meanwhile: keep the verified template bytes, record the finding in the report, and merge.

## Close the epic
1. Re-run every task's "Done when" and `npm run verify`. In this epic verify is green through format:check, lint and typecheck and then stops at `i18n:verify`, as expected until E06. Its other existing steps (knip, the guardrail, test:coverage, `check-deps.ts`) are run one by one and must pass. Any other red step is a real failure.
2. `/simplify` ran over `git diff main...HEAD` in T09. If any commit landed after T09, run it again over those commits and apply its fixes by T09's rules; where behaviour changes, test first. Then repeat step 1's runs.
3. `/code-review` ran in T09. If any commit landed after T09, run it again, fix every confirmed finding test-first (a failing test or checker line that shows the problem, then the fix), and repeat step 1's runs.
4. Update the evidence report from T07 with the final commit, T08's outcome and T09's findings. Check it with `node skills/git-commits-and-reporting/scripts/check-report.mjs reports/evidence-<YYYY-MM-DD>-e01-repo-foundation.md --kind slice`.
5. Merge: `git switch main && git merge --no-ff epic/e01-repo-foundation`, then `git branch -d epic/e01-repo-foundation`. Do not push: the owner decides when, and the pre-push hook's `npm run verify` cannot pass before E10. When both are true, run `git push origin main`.
