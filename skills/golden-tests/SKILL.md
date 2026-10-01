---
name: golden-tests
description: Creates and guards Pocket Arcade goldens - level and daily data goldens, board pixel goldens, the jest -u policy, Gate-Change trailers, the frozen daily contract. Use when adding a generator, board or golden, or a snapshot diff appears. Not for simulator screenshots (e2e-maestro) or unit tests.
---

# Golden tests

Goldens are the frozen answers of Pocket Arcade: the level each seed makes, the daily level of each date, the pixels of each board. They change only on purpose, after a real look, in a commit that says why, and the daily ones never change at all. This skill writes them and its scripts prove the tree and the history keep that policy.

## Rules that must hold

1. **A golden changes only by hand, one file at a time**: `npx jest <file> --selectProjects golden -u`, path first (after `--selectProjects` a path is read as a project name and every golden is rewritten). Every script, hook and CI run uses `jest --ci`, which refuses to write a missing snapshot. Never `-u` without a file, never `-u`, `--updateSnapshot`, `--ci=false` or a baseline `--update` in `package.json`, lefthook, CI or Claude Code hooks. Why: agents rubber-stamp whatever `-u` writes.
2. **Look before accepting.** Read the `.snap.ios` diff line by line; open every new or changed PNG (and the diff PNG) with the Read tool; then `CI=1 npx jest --ci --selectProjects golden` passes. Why: an unread golden freezes a bug.
3. **Every commit that adds, changes or deletes a golden path carries `Gate-Change: <which goldens, why, what you looked at>`.** Golden paths: `**/*.golden.test.ts.snap.ios`, `**/__snapshots__/*.golden.test.ts.snap`, `**/__image_snapshots__/**`, `apps/*/e2e/baselines/**`, `test/goldens/boards/skia-golden.ts`, `**/fixtures/save-v*.json`. Why: the owner can find every gate change later with one `git log` query.
4. **An existing daily-challenge golden never changes and is never deleted**, not even with a trailer; adding dates is fine. Pin at least three dates including a year boundary pair (`2026-12-31`, `2027-01-01`) with the game's real salt and daily difficulty. Why: spec 8.3, every phone and every app version must generate the same level for the same date.
5. **Data goldens are readable data**: `*.golden.test.ts` next to the unit, a string per case (a header line with seed, difficulty and headline numbers, then the board as ASCII rows via `renderCells`), stored as `<file>.golden.test.ts.snap.ios`. No component trees, no inline snapshots, no entry over 120 lines. Why: a golden is reviewed by reading its diff.
6. **Pixel goldens render the device's own `draw()`** through `paintBoardPng` in `test/goldens/boards/<game-id>-board.golden.test.ts`, at 3 sizes (390×560, 1024×700, 320×400) × moments 0, 0.5, 1 of the busiest turn, with the app's font loaded explicitly, matched only by `toMatchPixelGolden` from `skia-golden.ts`. Why: goldens catch what assertions forget, but only if they draw what players see.
7. **Tolerances are gates: 0.1% of pixels for boards, 0.2% for screens.** Never raise one to hide a diff; only the owner can agree, and the trailer says so. Why: a raised tolerance silently accepts every future regression below it.
8. **A failing golden is investigated, not re-accepted.** Unintended change: fix the code. A golden that differs between two runs of the same commit: the code reads time or randomness. Why: CanvasKit and the generators are deterministic; noise is a bug.

## Workflow

1. **Know the policy** once per session: read [references/golden-policy.md](references/golden-policy.md) (kinds, paths, the only way to change a golden, the daily contract, failure triage). On the Shell build the index places this skill's files: `game-kit/src/testing/render-cells.ts` with its test at Shell step 2 (level-generation-and-solvers' copy), the pilot's level and daily goldens at step 3, and `test/goldens/boards/skia-golden.ts` with the board golden and its nine PNGs at step 7, together with jest-image-snapshot and its companion `@types/jest-image-snapshot` (without the types, `npm run typecheck` fails TS7016 in skia-golden.ts).
2. **A data golden** (a new generator, pack, daily challenge or format): read [references/data-goldens.md](references/data-goldens.md). Copy [templates/level.golden.test.ts](templates/level.golden.test.ts) to `apps/<game-id>/src/levels/generate-level.golden.test.ts`, replace every `__UPPER_SNAKE__` placeholder (salt, daily difficulty, target field, max difficulty) and adapt `describeLevel` to what the player sees. If `packages/game-kit/src/testing/render-cells.ts` is missing, copy it and its test from `templates/packages/game-kit/src/testing/`. [examples/generate-level.golden.test.ts](examples/generate-level.golden.test.ts) and its `.snap.ios` show the verified result. A game whose level table came from `level-generation-and-solvers` already has `apps/<game-id>/src/levels/<game-id>-levels.golden.test.ts` with the daily dates: extend that file instead of adding a second daily golden.
3. **A board pixel golden**: read [references/pixel-goldens.md](references/pixel-goldens.md). If `test/goldens/boards/skia-golden.ts` is missing, copy [templates/test/goldens/boards/skia-golden.ts](templates/test/goldens/boards/skia-golden.ts) and, if the root lacks them, `npm install --save-dev --save-exact jest-image-snapshot@6.5.2 @types/jest-image-snapshot@6.4.2`. Copy `templates/test/goldens/boards/__GAME_ID__-board.golden.test.ts` to `test/goldens/boards/<game-id>-board.golden.test.ts`, replace `__GAME_ID__` (kebab), `__GAME_CAMEL__` and `__GAME_PASCAL__`, replace the template game's (Tap Flip) `VIEW` and `EVENTS` with your game's realistic mid-game view and busiest turn, then run `npx eslint --fix` and `npx prettier --write` on it (import order depends on the game id). The board's draw, layout and timeline come from the board work.
4. **Create the goldens deliberately**: `npx jest <file> --selectProjects golden -u`. Read the new `.snap.ios` or open all nine PNGs with the Read tool, compare with what the spec and design say players should see, then `CI=1 npx jest --ci --selectProjects golden`.
5. **Check the tree**: `node ${CLAUDE_SKILL_DIR}/scripts/check-goldens.mjs .` and fix every `FAIL` line (file, rule, fix), rerun until `RESULT: PASS`.
6. **Commit with the trailer** from [templates/gate-change-commit.txt](templates/gate-change-commit.txt). Before committing, write the message to a file and run `node ${CLAUDE_SKILL_DIR}/scripts/check-golden-changes.mjs . --staged --message <file>`; at the end of the session run it with `--range <base>..HEAD` (base = the commit before the session's first).
7. **When a golden fails later**: follow "When a golden fails" in the policy reference. Bug: fix the code and keep the golden. Intended: step 4 for that one file, then step 6. A daily entry changed: always a bug; if the generator truly must change, stop and ask the owner (new salt from a future date, or a break on one release day).

## Definition of done

- [ ] Every data golden has its `.snap.ios`, every pixel golden its nine PNGs, and `CI=1 npx jest --ci --selectProjects golden` passes.
- [ ] Every new or changed golden was read (snapshot) or opened (PNG), and the report lists them with the reason.
- [ ] Each game with a daily challenge pins at least three dates with a year boundary, and no existing daily entry changed.
- [ ] Every golden change sits in a commit with a `Gate-Change:` trailer; no tolerance went up.
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/check-golden-changes.mjs . --range <base>..HEAD` prints `RESULT: PASS`.
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/check-goldens.mjs .` prints `RESULT: PASS`

## Anti-patterns

- **`npx jest -u` to make a red suite green.** It rewrites every golden that differs, bugs included. Read the failure, fix the code, and update only the one file you meant to change.
- **Editing the `.snap.ios` by hand.** The next `-u` or a renamed test undoes it, and it hides what the code really produces. Change the code, then regenerate that file.
- **Re-accepting a daily golden "because the generator improved".** Players on the old and new app get different levels on the same day. Keep the output identical or ask the owner.
- **A 400-line JSON dump as a golden.** Nobody reviews it, so any change gets accepted. Render the board as ASCII and pin the fields that matter.
- **`toMatchSnapshot()` on a rendered screen.** Component trees churn on every style tweak and train `-u` reflexes. Assert roles and text; screens are covered by simulator screenshots.
- **`failureThreshold: 0.01` in a test "because CanvasKit is noisy".** CanvasKit is byte-identical run to run; noise means the draw path reads time or randomness.
- **Pixel goldens that skip `small` or the 0 and 1 moments.** Clipping at narrow sizes and wrong start or end states are the most common board bugs.

## Files in this skill

| File | What it is | Read/run when |
|---|---|---|
| [references/golden-policy.md](references/golden-policy.md) | The three kinds of golden, where they live, the only way to change one, gated paths and trailer, the daily contract, failure triage, obsolete snapshots | Workflow step 1, and whenever a golden fails |
| [references/data-goldens.md](references/data-goldens.md) | What deserves a data golden, readable snapshots, the level + daily file, the snapshot format, reading a diff | Workflow step 2 |
| [references/pixel-goldens.md](references/pixel-goldens.md) | The matcher, sizes and moments, fonts, accepting baselines, reading a failure, headless previews | Workflow step 3 |
| [templates/level.golden.test.ts](templates/level.golden.test.ts) | Data golden for a generator plus the daily dates | Workflow step 2 |
| [templates/packages/game-kit/src/testing/render-cells.ts](templates/packages/game-kit/src/testing/render-cells.ts) | Cells to ASCII rows for readable goldens | Workflow step 2, when missing |
| [templates/packages/game-kit/src/testing/render-cells.test.ts](templates/packages/game-kit/src/testing/render-cells.test.ts) | Its test | Copied with it |
| [templates/test/goldens/boards/skia-golden.ts](templates/test/goldens/boards/skia-golden.ts) | `toMatchPixelGolden`: 0.1% tolerance, diffs to `reports/visual/diff/` | Workflow step 3, when missing |
| `templates/test/goldens/boards/__GAME_ID__-board.golden.test.ts` | Board pixel golden of the template game (Tap Flip): 3 sizes × 3 moments through `paintBoardPng`; synced from the library (also in board-rendering-skia) | Workflow step 3 |
| [templates/gate-change-commit.txt](templates/gate-change-commit.txt) | Commit message with the Gate-Change trailer | Workflow step 6 |
| [examples/generate-level.golden.test.ts](examples/generate-level.golden.test.ts) | Verified Line Siege level and daily golden | To imitate in step 2 |
| [examples/generate-level.golden.test.ts.snap.ios](examples/generate-level.golden.test.ts.snap.ios) | Its reviewed snapshot (what a readable golden looks like) | To imitate in step 2 |
| `scripts/check-goldens.mjs` | Checks the tree: snapshots present and readable, no orphans or component snapshots, pixel matcher, sizes, baselines, daily dates, no automated `-u`, gated paths, ignored diffs | Workflow step 5 and the definition of done |
| `scripts/check-golden-changes.mjs` | Checks commits or the staged change: Gate-Change trailers, daily goldens never edited or deleted, tolerances never raised | Workflow step 6 and the definition of done |
| `scripts/selftest.mjs` | Proves both checkers pass good fixtures and catch every planted bug | After changing a checker |
| `scripts/check-lib.mjs` | Shared script helper, synced from the library (do not edit here) | Never by hand |
| `assets/shared.json` | Declares the shared files this skill copies in | When adding a shared file |
| `tests/fixtures/` | Good and planted-bad trees, and real `git log` captures, for the self-test | When adding a rule to a checker |

## Related skills

- `unit-and-component-tests` - the Jest projects the goldens run in and every non-golden test.
- `board-rendering-skia` - the board's draw, layout, timeline and draw-call tests that the pixel golden renders.
- `level-generation-and-solvers` - the generators and daily seeds the data goldens pin.
- `e2e-maestro` - simulator screenshot baselines and the screenshot matrix.
- `git-commits-and-reporting` - the commit message format and the evidence report.
- `quality-gates` - the commit-msg hook and `quality-gates.json` that enforce gated paths.
