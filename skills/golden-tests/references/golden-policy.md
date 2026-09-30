# Golden policy: what a golden is and when it may change

Goldens are the frozen answers of Pocket Arcade: the level a seed makes, the daily level of a date, the pixels of a board. They exist because assertions forget things and because one agent writes both code and tests. This page is the policy; `data-goldens.md` and `pixel-goldens.md` say how to write each kind.

## Contents

- The three kinds of golden
- Where goldens live
- How goldens are created and changed (the only way)
- The Gate-Change trailer and the gated paths
- The daily-challenge contract
- When a golden fails
- Obsolete and orphaned snapshots
- What never becomes a golden

## The three kinds of golden

| Kind | What it pins | Test file | Stored as | Tolerance |
|---|---|---|---|---|
| Data golden | generated levels per seed and difficulty, daily levels per date, any output format players or saves depend on | `<unit>.golden.test.ts` next to the unit (Jest `golden` project) | `<test>.golden.test.ts.snap.ios` next to the test | exact |
| Pixel golden | a board's picture from the same `draw()` the device runs, at 3 sizes × 3 moments | `test/goldens/boards/<game-id>-board.golden.test.ts` | `test/goldens/boards/__image_snapshots__/<id>.png` | 0.1% of pixels |
| Screenshot baseline | a whole screen on the simulator (4 languages × light/dark × phone/tablet) | the screenshot matrix (see the `e2e-maestro` skill) | `apps/<game-id>/e2e/baselines/<device>/<lang>-<theme>/<screen>.png` | 0.2% of pixels |

The same policy covers all three: they change only on purpose, after a person-level look at the new version, in a commit that says why.

Pinned values inside ordinary tests (the RNG's seed-1 sequence in `sfc32.test.ts`, `dailySeed('2026-09-26', 17) === 2_599_028_541` in `date-key.test.ts`) are goldens too: they are compatibility contracts written as `toBe(...)`, and editing them follows the same rules. They run in the `unit` project, not in `npm run test:golden`: at Shell step 2 prove them with `npx jest packages/game-kit/src/dates packages/game-kit/src/rng --ci --selectProjects unit`. `npm run test:golden` is due from Shell step 3, which adds the first `*.golden.test.ts`; before that it finds no tests and exits 1, which is correct (nothing uses `--passWithNoTests`).

## Where goldens live

- The `golden` Jest project matches only `*.golden.test.ts` and runs in Skia's CanvasKit environment (`@shopify/react-native-skia/jestEnv.js` + `jestSetup.js`), with the Shell's Intl polyfills loaded first. So a data golden may render text or numbers exactly like the app does.
- `jest-expo/ios` uses a platform snapshot resolver: a data golden's snapshot is written as `<file>.golden.test.ts.snap.ios` **next to the test** (not in `__snapshots__/`; verified). A plain `__snapshots__/<file>.golden.test.ts.snap` appears only if a project without the iOS resolver writes it.
- Data goldens that need no Node API stay colocated (`apps/<game-id>/src/levels/generate-level.golden.test.ts`). Pixel goldens read a font with `node:fs` and use `Buffer`, and Node APIs are banned under `apps/*/src` and `packages/*/src`, so they live in the root `test/goldens/boards/`.
- Diffs are never committed: pixel diffs go to `reports/visual/diff/` (and jest-image-snapshot's own `__image_snapshots__/__diff_output__/`, which `.gitignore` lists).

## How goldens are created and changed (the only way)

1. Every script and hook runs Jest with `--ci`. `jest --ci` refuses to write a snapshot that does not exist yet (verified for data and image snapshots), so a new golden fails until someone creates it deliberately.
2. Create or update the goldens of **one file** with:

   ```sh
   npx jest <path/to/file.golden.test.ts> --selectProjects golden -u
   ```

   The path comes first. `--selectProjects` accepts several project names, so in `npx jest --selectProjects golden <file> -u` Jest reads the path as a second project name and rewrites every golden of the project (verified with `--listTests`). Never `-u` without a file, never `-u` in `package.json` scripts, lefthook, CI or Claude Code hooks, never `--ci=false`. Before `-u`, `npx jest <file> --selectProjects golden --listTests` shows exactly which files would be rewritten.
3. Look at the result before anything else:
   - data golden: read the `.snap.ios` diff (`git diff -- <file>.snap.ios`); every changed board must be what players should now get;
   - pixel golden: open every new or changed PNG under `__image_snapshots__/` with the Read tool, and the diff PNG in `reports/visual/diff/` when there is one.
4. Rerun without `-u`: `CI=1 npx jest --ci --selectProjects golden` must pass.
5. Commit the goldens together with the code that changed them, with a `Gate-Change: <which goldens and why>` trailer.

## The Gate-Change trailer and the gated paths

A commit that adds, changes or deletes a gated path needs a trailer in the message body:

```text
feat(line-siege): add the column-clear burst to the board

Gate-Change: line-siege board goldens re-accepted; the burst now shows at 0.5 (looked at all 9 PNGs)
```

The commit-msg hook rejects a commit that touches a gated path without the trailer, and `check-golden-changes.mjs` checks the same thing for any range of commits. The golden-related gated paths:

| Pattern | What it protects |
|---|---|
| `**/*.golden.test.ts.snap.ios` | data golden snapshots (what `jest-expo/ios` writes) |
| `**/__snapshots__/*.golden.test.ts.snap` | data golden snapshots written without the iOS resolver |
| `**/__image_snapshots__/**` | pixel golden baselines |
| `apps/*/e2e/baselines/**` | simulator screenshot baselines |
| `test/goldens/boards/skia-golden.ts` | the pixel matcher, which holds the 0.1% tolerance |
| `**/fixtures/save-v*.json` | frozen save fixtures (the save work owns them; never edit a shipped one) |

Find every gate change later with `git log --format='%h %s%n%(trailers:key=Gate-Change)' --grep='^Gate-Change:'`.

A tolerance is a gate, not a golden: raising `failureThreshold` in `skia-golden.ts` or the screenshot `MAX_DIFF_RATIO` needs the owner's agreement, recorded in the Gate-Change trailer ("owner approved …"). Never raise one to hide a diff.

## The daily-challenge contract

Spec 8.3: the daily level comes from today's local date plus the game's own salt, through the same generator as normal levels, at the game's daily difficulty; every phone on the same date gets the same level, offline. So:

- The daily goldens pin `describeLevel(dailySeed(date, SALT), DAILY_DIFFICULTY)` for fixed dates. Every app version must produce exactly those levels.
- **An existing daily golden never changes and is never deleted**, not even with a Gate-Change trailer: players on an older app version and players on the new one would get different levels on the same day. `check-golden-changes.mjs` fails any commit that edits or removes an existing daily entry.
- Adding a new date is fine (a normal Gate-Change commit).
- If the generator must change, the change must keep every pinned daily level identical. When that is impossible, stop and ask the owner: the options are a new salt from a future date (so past and present days stay identical) or accepting that the daily contract breaks for everyone on one release day.
- `dailySeed` itself and the RNG's pinned sequence are part of the same contract.
- Pin at least three dates, one of them a year boundary pair (`2026-12-31` and `2027-01-01`): date-key bugs live at month and year ends.

## When a golden fails

1. Read the failure. Data golden: Jest prints the snapshot diff (`- Snapshot` / `+ Received`). Pixel golden: `Expected image to match or be a close match to snapshot but was 3.7083333333333335% different from snapshot (6408 differing pixels)`, and the diff PNG path.
2. Decide: is the new output a bug or the intended result of the change you just made?
   - A bug (a rule change leaked into generation, a draw call moved): fix the code; the golden stays.
   - Intended: update that one file with `-u`, look at every changed entry or PNG, commit with Gate-Change.
   - A daily entry changed: it is always a bug (see above).
3. A pixel golden that differs between two runs on the same commit means the draw path reads time or randomness (CanvasKit renders are byte-identical run to run): fix the draw path, never the tolerance.

## Obsolete and orphaned snapshots

- An entry whose test was renamed or removed is "obsolete": Jest prints `1 snapshot obsolete` and exits 1 even though every test passed (verified with Jest 29.7, with and without `--ci`). Remove it with `-u` on that one file, in a Gate-Change commit that says which test went away. A daily entry never becomes obsolete: its test is never renamed or removed.
- A `.snap.ios` whose test file no longer exists is an orphan; delete it in the same commit that removed the test.
- A `.snap` for a non-golden test means someone snapshotted a component tree; delete the snapshot and assert roles and text instead.

## What never becomes a golden

- Component trees (`toMatchSnapshot()` on a rendered screen): agents rubber-stamp large UI snapshots with `-u`. Screens are covered by RNTL assertions and simulator screenshots.
- Inline snapshots (`toMatchInlineSnapshot`): `-u` rewrites the test file itself, outside the gated snapshot paths.
- Anything that depends on the clock, the machine's locale or time zone, or unseeded randomness.
- Huge JSON dumps nobody can review. Render what a player sees (ASCII boards, short lines) or pick the fields that matter.
