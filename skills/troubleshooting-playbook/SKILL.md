---
name: troubleshooting-playbook
description: Diagnoses and fixes Pocket Arcade failures with a catalogue of 300+ known ones (symptom, cause, fix). Use when something errors, crashes, hangs or renders wrong, or an error or log needs explaining. Not for gate setup (quality-gates) or running builds (ios-simulator-build, ios-release-testflight).
---

# Troubleshooting playbook

Turns an error into a proven fix fast: look the failure up in the catalogue of every failure solved so far (over 300 entries, each with symptom, cause, fix, status and the skill that owns the procedure), apply the fix at its cause, prove it with the command that failed, and record anything new so the next session finds it in seconds.

## Rules that must hold

1. **Look it up before you diagnose.** Run `find-fix.mjs` with the exact first error line before touching code. Many fixes here are counter-intuitive (a Metro cache that ignores the variant, a frame clock that resets on restart) and were expensive to find; guessing repeats that cost.
2. **Fix the cause, never the check.** No widened tolerance, skipped or deleted test, `eslint-disable`, raised limit, regenerated golden or loosened version to make a failure go away. A green gate over a real bug ships the bug.
3. **Rows marked owner are stops.** Keychain, agreements, 401/403, a missing app record, the Xcode licence, `sudo`, consoles and product decisions: send the owner one message (the step, the exact error line, the one action needed) and wait. Retrying can lock the account or burn build numbers; the decisions are the owner's.
4. **When an entry names a skill, load that skill for the fix.** The catalogue gives the diagnosis; the owning skill has the full procedure, templates and checks that prove the fix.
5. **A fix is proven only by rerunning the command that failed, then the area's gate.** "The error went away once" is not evidence; the same command passing, and then `check:fast`, `verify`, the simulator build or the release gate, is.
6. **Treat `open` entries as the current decision, not as bugs.** Their fix is the agreed fallback. Tell the owner when you hit one; never settle it silently.
7. **Record every newly solved failure in `assets/known-failures.json`, never in the rendered references.** Then re-render with `check-catalogue.mjs --write`. When the cause is visible in repo files, add a rule to `scripts/lib/pitfalls.mjs` with a planted-bug fixture, so the checker catches it before it happens.
8. **Change one thing at a time; after three failed hypotheses, stop and report** what was tried and what the evidence shows. A pile of simultaneous changes hides the cause, and a stuck report beats a clever workaround.
9. **Never destroy evidence or other tasks' state to "start clean".** No `simctl erase all` or `shutdown all`, no `xcode-select`, no wiping caches or `node_modules` before the cause is known, never `npm install` through a symlinked `node_modules`.

## Workflow

1. **Capture** the first error line (not the last) and the command that produced it. The logs are listed in [references/diagnosing-new-failures.md](references/diagnosing-new-failures.md) ("Where the evidence is").
2. **Look it up:** `node ${CLAUDE_SKILL_DIR}/scripts/find-fix.mjs --text "<first error line>"`. Also try two or three plain words for what you see ("banner never appears"), `--log <file>` for a whole log (error patterns only), or `--id <id>` for an id another checker printed. Every `MATCH` prints the cause, the fix, the status and the owning skill.
3. **Act on the match.** Marked `stop and ask the owner`: send the stop message and end the step. Names a skill: load it and apply the fix with its procedure. Otherwise apply the fix directly. The full table of the area is in its reference (below); read it when the match is close but not exact.
4. **No match, or the fix did not work:** read [references/diagnosing-new-failures.md](references/diagnosing-new-failures.md) and follow its loop: reproduce cleanly, change one thing at a time, suspect the newest change first, make a minimal repro in a scratch copy for library bugs.
5. **Scan for known pitfalls** before a first simulator build, a release, a dependency or SDK bump, a new game, and whenever failures repeat: `node ${CLAUDE_SKILL_DIR}/scripts/check-known-pitfalls.mjs .` from the repo root. Each `FAIL` line names the file, the catalogue id, the fix and the cause; fix and rerun until `RESULT: PASS`.
6. **Verify:** rerun the failing command, then the area's gate (`npm run -s check:fast`, `npm run verify`, `npm run build:ios:sim -- --app <game>`, or the release gate).
7. **Record:** add or correct the entry in `assets/known-failures.json` (field rules in the diagnosing reference), run `node ${CLAUDE_SKILL_DIR}/scripts/check-catalogue.mjs --write`, then `check-catalogue.mjs` without flags. Add the exact first error line as one line of `tests/fixtures/find-fix-text/good/queries.txt`, so the self-test proves `find-fix.mjs` finds it. If you added a pitfall rule, add its planted bug to a `tests/fixtures/check-known-pitfalls/bad-*` folder. Then run `node ${CLAUDE_SKILL_DIR}/scripts/selftest.mjs`.
8. **Report** in plain words: what failed, the cause, the fix, the evidence (the passing command and the `RESULT` lines), the catalogue id, and any owner action still needed.

The catalogue by area (each reference is a generated table: ID, symptom, cause, fix, status, skill):

| Area | Reference | Covers |
|---|---|---|
| build | [references/build-and-simulator.md](references/build-and-simulator.md) | Xcode selection, app.config.ts, variants, prebuild, xcodebuild, simulator, screenshots |
| release | [references/release-and-signing.md](references/release-and-signing.md) | signing, keychain, export, store gate, upload, processing, App Store Connect |
| deps | [references/dependencies-and-supply-chain.md](references/dependencies-and-supply-chain.md) | pins, release age, install scripts, held-back majors, banned packages, knip |
| lint | [references/typescript-and-lint.md](references/typescript-and-lint.md) | TS error codes, ESLint config bugs, naming, imports |
| testing | [references/testing-and-e2e.md](references/testing-and-e2e.md) | Jest setup, mocks, RNTL, goldens, coverage, Stryker, Maestro |
| engine | [references/rendering-and-game-loop.md](references/rendering-and-game-loop.md) | frame clock, determinism, worklets, Skia, Reanimated, gestures, physics |
| i18n | [references/i18n-and-rtl.md](references/i18n-and-rtl.md) | Hermes Intl, catalogs, RTL layout, direction reload, fonts |
| services | [references/ads-purchases-privacy.md](references/ads-purchases-privacy.md) | AdMob, consent, StoreKit, audio, haptics, privacy manifests |
| state | [references/state-persistence-navigation.md](references/state-persistence-navigation.md) | save file, SQLite, stores, navigator, statistics, daily |
| parity | [references/visual-parity.md](references/visual-parity.md) | design capture, app capture, comparison traps |
| gates | [references/quality-gates-and-git.md](references/quality-gates-and-git.md) | commit rules, hooks, guardrail, Claude Code settings |
| perf | [references/performance-and-accessibility.md](references/performance-and-accessibility.md) | cold start, budgets, contrast, text scaling |
| skills | [references/claude-code-and-skills.md](references/claude-code-and-skills.md) | skills that do not load, trigger or run |
| open | [references/open-risks.md](references/open-risks.md) | unverified behaviour and owner decisions, with the fallback until settled |

## Definition of done

- [ ] The command that failed now passes, and the gate of its area passes.
- [ ] The fix is at the cause: no check, limit, tolerance, golden or test was weakened, and no owner stop was worked around.
- [ ] Owner actions, if any, were sent as one message and are named in the report.
- [ ] A failure that was not in the catalogue is now an entry (or the wrong entry was corrected) and `node ${CLAUDE_SKILL_DIR}/scripts/check-catalogue.mjs` prints `RESULT: PASS`.
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/check-known-pitfalls.mjs .` prints `RESULT: PASS`

## Anti-patterns

- **Fixing from memory.** Training data uses APIs this stack removed or changed (`runOnJS`, `.value`, `Skia.Path.Make()`, RNGH builder callbacks, Jest 30, ESLint 10). Look up first, then read the installed source.
- **Retrying `errSecInternalComponent`, a 401 or an agreement error.** These are stops; send the message.
- **Raising `max-params` or a pixel tolerance because a check fails.** That hides the defect and needs a `Gate-Change:` trailer and the owner anyway.
- **`xcrun simctl erase all` or deleting `~/Library/Developer` "to start fresh".** Other tasks' simulators and all evidence are gone; clean only `apps/<game>/build` and your own `e07-*` simulator.
- **Editing `references/build-and-simulator.md` to add a row.** The next `--write` erases it; edit the JSON.
- **An entry like "build failed, rebuild".** Symptoms quote the error text, causes say why, fixes say what to change, and match patterns are specific.
- **Declaring victory after one green run of a flaky test.** Find why it flaked (time, randomness, order, a real race); `jest.retryTimes` is banned.

## Files in this skill

| File | What it is | Read/run when |
|---|---|---|
| [references/diagnosing-new-failures.md](references/diagnosing-new-failures.md) | The loop for unknown failures, where every log is, isolation, stop rules, the entry fields and a worked example | Workflow steps 1, 4 and 7 |
| [references/build-and-simulator.md](references/build-and-simulator.md) | Generated table: build area | Workflow step 3, build failures |
| [references/release-and-signing.md](references/release-and-signing.md) | Generated table: release area | Workflow step 3, release failures |
| [references/dependencies-and-supply-chain.md](references/dependencies-and-supply-chain.md) | Generated table: deps area | Workflow step 3, install and upgrade failures |
| [references/typescript-and-lint.md](references/typescript-and-lint.md) | Generated table: lint area | Workflow step 3, tsc and ESLint errors |
| [references/testing-and-e2e.md](references/testing-and-e2e.md) | Generated table: testing area | Workflow step 3, test failures |
| [references/rendering-and-game-loop.md](references/rendering-and-game-loop.md) | Generated table: engine area | Workflow step 3, board, animation and gesture bugs |
| [references/i18n-and-rtl.md](references/i18n-and-rtl.md) | Generated table: i18n area | Workflow step 3, language and RTL bugs |
| [references/ads-purchases-privacy.md](references/ads-purchases-privacy.md) | Generated table: services area | Workflow step 3, ads, IAP, audio and privacy |
| [references/state-persistence-navigation.md](references/state-persistence-navigation.md) | Generated table: state area | Workflow step 3, save and navigation bugs |
| [references/visual-parity.md](references/visual-parity.md) | Generated table: parity area | Workflow step 3, design comparison problems |
| [references/quality-gates-and-git.md](references/quality-gates-and-git.md) | Generated table: gates area | Workflow step 3, hook and commit failures |
| [references/performance-and-accessibility.md](references/performance-and-accessibility.md) | Generated table: perf area | Workflow step 3, perf and a11y findings |
| [references/claude-code-and-skills.md](references/claude-code-and-skills.md) | Generated table: skills area | Workflow step 3, a skill misbehaves |
| [references/open-risks.md](references/open-risks.md) | Generated table: open risks and owner decisions | Workflow step 3, and before telling the owner about an open item |
| `assets/known-failures.json` | The catalogue: 14 areas and every entry (the one place entries are written) | Workflow step 7 |
| `scripts/find-fix.mjs` | Looks up error text, a log or an id; exit 1 when nothing is known | Workflow step 2 |
| `scripts/check-known-pitfalls.mjs` | Scans the app repo for the known failures visible in files (variants, banned packages, clock, selectors, configs, flows, export options) | Workflow step 5 and the definition of done |
| `scripts/check-catalogue.mjs` | Validates the catalogue, renders (`--write`) and checks the area references, checks pitfall ids | Workflow step 7 |
| `scripts/lib/catalogue.mjs` | Catalogue loader, validator and renderer | When changing the entry format |
| `scripts/lib/pitfalls.mjs` | The pitfall rules, one per catalogue id | Workflow step 7, to add a rule |
| `scripts/selftest.mjs` | Proves all three scripts pass good fixtures and catch every planted bug, and that `find-fix.mjs` finds each exact error text in `tests/fixtures/find-fix-text/good/queries.txt` | After changing a script, a rule or an entry's match patterns |
| `scripts/check-lib.mjs` | Shared script helper, synced from the library (do not edit here) | Never by hand |
| `assets/shared.json` | Declares the shared files this skill copies in | When adding a shared file |
| `tests/fixtures/` | Good and planted-bad repos, catalogues, logs and error-text queries for the self-test | When adding a rule, or an entry whose text must be found |

## Related skills

- `ios-simulator-build` - running and proving the Release simulator build.
- `ios-release-testflight` - the release pipeline and its own stop table.
- `quality-gates` - what each gate checks and the Gate-Change rule.
- `dependency-management` - installing, pinning and upgrading packages.
- `expo-sdk-upgrade` - moving SDK or Xcode, where many held-back entries end.
- `skill-maintenance` - a skill that does not load, trigger or pass the validator.
- `git-commits-and-reporting` - the owner report and stop messages.
