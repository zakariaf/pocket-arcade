# Boot hydration, SQL tests and the kill test

How the save is read at startup (synchronously, before the first frame, and never written before the direction check), how the real SQL is tested on Node, and how the simulator (and Android emulator) kill test proves the whole write path.

## Contents

- The boot sequence
- The startup peek (read-only)
- hydrateSave and the resume route
- The composition root
- The clock adapter
- Tests on node:sqlite
- The kill test (and on Android)
- inspect-save: reading a save.db
- What has been verified

## The boot sequence

Everything up to the first render is synchronous; the native splash covers it.

| Step | Where | Writes? |
|---|---|---|
| 1. Intl polyfills | first import of `start-shell.ts` | no |
| 2. Peek the saved language | `peekCurrentSave()`: open `save.db`, read `current.payload`, `JSON.parse`, close; no validation | no |
| 3. Resolve the language, plan the direction | the i18n layer, with the key-value direction guard | guard only |
| 4a. `restart`: register the startup splash, which reloads after it has mounted | `create-startup-splash.tsx` (toybox-screens) | no save write |
| 4b. `keep` or `give-up`: `createShellApp` (game-host-integration's template) | `create-shell-app.tsx` | |
| 5. Read the runtime config | `readGameExtra()` in `createDeviceAdapters()` | no |
| 6. Open the driver, the save store, the error log, the clock | `createDeviceAdapters()` (`device-adapters.ts`) | no |
| 7. Read both slots, `planLoad`, `SaveService`, `applyLoadWrites` | `hydrate-save.ts` | the first save write |
| 8. Validate the run with the game's parsers; drop only an invalid run | the game host | only if dropped |
| 9. Create the stores from `save.doc()` | `createShellStores(hydrated.save)` | no |
| 10. Compute the resume `initialState` | `resumeState(doc)` | no |
| 11. `registerRootComponent(ShellRoot)`; first frame; the native splash hides | | |
| 12. After the first frame, never awaited: consent refresh, Premium re-check, connectivity, sound bank | their own services | through `save.update` |

Why nothing is written before step 7: module code runs again after a direction reload, so an earlier write would happen twice; and a reload triggered during bundle evaluation crashed a Release build ("AppRegistryBinding::startSurface failed. Global was not installed"), which is why the reload runs from the mounted splash.

## The startup peek (read-only)

```ts
// services/save/peek-current-save.ts
export function peekCurrentSave(): unknown {
  const driver = createExpoSqliteSqlDriver(SAVE_DB_FILE);
  try {
    const payload = driver.get(SELECT_SLOT_SQL, ['current'])?.['payload'];
    return typeof payload === 'string' ? (JSON.parse(payload) as unknown) : null;
  } catch {
    return null; // first launch (no table yet) or an unreadable row: the full load decides
  } finally {
    driver.close();
  }
}
```

No DDL, no pragma, no validation, no migration, no write (`check-save-layer` reports `.run`, `.exec` or `.transaction` here as `peek-writes`). If `current` is damaged but `backup` holds another language, the peek falls back to the device language; the full load then restores the backup, and the next cold start corrects the direction.

## hydrateSave and the resume route

```ts
// app/hydrate-save.ts
export function hydrateSave(deps: HydrateDeps): Hydrated {
  const { store } = deps; // createSqliteSaveStore(driver) on a device, createFakeSaveStore() in Jest
  const input = {
    current: store.read('current'), backup: store.read('backup'), gameId: deps.gameId,
    newerStructure: store.newerStructureVersion(), // save.db tables from a newer app: read-only
  };
  const plan = planLoad(input);
  const save = createSaveService(
    { store, clock, errorLog, appVersion, isStrict: TEST_ONLY !== null }, plan, lastWriteCount(input));
  save.applyLoadWrites();
  return { save, outcome: plan.outcome, initialState: resumeState(save.doc()) };
}

/** Relaunch inside a level lands on Game (paused) above Home (spec S5). */
export function resumeState(doc: SaveDoc): InitialState | undefined {
  if (!doc.firstRun.tutorialDone || doc.run?.resumeOnLaunch !== true) return undefined;
  return { index: 1, routes: [{ name: 'Home' }, { name: 'Game', params: { start: 'resume' } }] };
}
```

`outcome` drives the S14 dialog on the first screen through game-host-integration's `LoadOutcomeOpener` (`app/load-outcome-opener.tsx`, mounted in the dialog host): "Progress restored" after `restored-from-backup`, "please update" after `newer-version`; a reset after damage has no backup to announce (its reason is in the error log). `isStrict` is on in test builds, so an invalid document throws there. Nothing in `hydrateSave` throws for data reasons: damaged rows fall back, a newer document or newer tables play read-only, and a disk that refuses the planned quarantines and writes (full) is logged while the session plays on in memory with `save.didLastWriteFail()` true (spec 8.14: never a crash loop). `HydrateDeps` takes the `SaveStore` rather than the driver, so `hydrate-save.test.ts` runs the real load over `createFakeSaveStore()`: a first launch writes both slots and resumes nothing, a relaunch loads what the last one wrote, a newer `save.db` plays read-only without a write, and `resumeState` lands a killed level on Game (paused) above Home only after the tutorial.

## The composition root

The composition root is game-host-integration's template set (`packages/shell/src/app/`). `createShellApp(input)` (called only after the direction check) builds `createDeviceAdapters()` once: `createExpoSqliteSqlDriver(SAVE_DB_FILE)` shared by `createSqliteSaveStore(driver)` and `createSqliteErrorLogAdapter(driver, clock)`, the system clock, and `readGameExtra()`. `createShellParts(input, adapters)` then runs `hydrateSave({ store, clock, errorLog, gameId, appVersion })`, logs a direction give-up as `'boot'` (the `error_log` table exists only after the DDL), creates the game host (it may drop an unreadable run), then `createShellStores(save)`, and recomputes the resume state with `resumeState(save.doc())` after the host. `ShellApp` calls `useCheckpointOnBackground(save)` once.

## The clock adapter

`services/clock/` ships as four files plus tests, identical in every skill that has them: `clock-port.ts` (`nowMs()`, `today()`, `msUntilNextLocalDay()`), `system-clock-adapter.ts`, `fake-clock.ts` (`createFakeClock({ nowMs, today, msUntilNextLocalDay? })` with `advance(ms)` and `setToday(day)`), and their tests. The adapter is the only file allowed to read `Date` (the lint config exempts `services/clock/*-adapter.ts`): `nowMs: () => Date.now()`, `today: () => 'YYYY-MM-DD'` from the local calendar (`getFullYear`, `getMonth() + 1`, `getDate()`, zero-padded), and `msUntilNextLocalDay` from `new Date(y, m, d + 1)` minus now (time zone and daylight saving handled by Date; used by S9's "Next challenge in" line). Its test uses Jest fake timers, so it holds in any time zone. Test builds wrap it so the debug menu can "set the date" (only `today()` changes). The save layer itself only reads `nowMs()`: `SaveService`, `hydrateSave` and the error log take `Pick<ClockPort, 'nowMs'>`.

## Tests on node:sqlite

`test/integration/save/sqlite-save-store.test.ts` runs the Shell's real SQL on Node's `node:sqlite` through `createNodeSqliteSqlDriver`, in a temporary folder per test:

| Test | Proves |
|---|---|
| uses WAL and synchronous FULL | the pragmas run on open (`journal_mode` is `wal`, `synchronous` is 2 even after the test sets NORMAL first) |
| reloads a document written to current and backup | a reopened file plans `loaded` with the same document |
| restores the backup when current is corrupted and quarantines current | a broken payload gives `restored-from-backup` with reason `checksum`, and quarantine adds a row |
| rolls back a failed transaction | a throw inside `driver.transaction` leaves the old payload |
| checkpoints the WAL into the main file | after `checkpoint()` a PASSIVE checkpoint reports nothing left (`log: 0`) |
| keeps only the newest 10 quarantined rows | after 12 quarantines `save_quarantine` holds 10 rows, the oldest two dropped |

`load-plan.test.ts` (no SQL) covers every branch: fresh, loaded, restored with quarantine, newer version writes nothing, both damaged resets and keeps both bad copies, and another game's save is damaged; a fast-check property feeds it any two rows (good, bit-rotted, foreign, other versions) and always gets a valid document and a known outcome, and `lastWriteCount` takes the higher count of both rows. `save-service.test.ts` covers the rising write counter, current-only writes unless `refreshBackup`, throw-on-invalid in test builds, log-and-skip in store builds (recorded under `save`), the Premium guard (with a property over any two Premium sections), read-only for a newer save, and a refused write (in `update` and at boot) that is logged, never thrown, and reported by `didLastWriteFail()`, a refused backup refresh that stays due until a write with the backup lands, and the boot's write-both held back by a pending quarantine copy until it lands. `save-codec.test.ts` adds a round-trip property and rejects an unknown key; `checksum.test.ts` pins the FNV-1a 32 vectors; `schema/default-save-doc.test.ts` proves the first-launch document is valid and pinned; `reset-progress.test.ts` and `test/integration/save/sqlite-error-log-adapter.test.ts` quote their spec lines. Copy every one unchanged: they are the tests the save folder's 95 % threshold is measured with. Coverage target for `packages/shell/src/services/save/`: 95 % statements, lines and functions, 90 % branches (a Jest `coverageThreshold` key, active once the folder has source files).

## The kill test

Jest proves the SQL; only killing the real app proves the whole write path (spec 15: "killing the app at any moment loses at most the move in progress"). It needs a Release build of the test variant installed on a dedicated simulator (building it is the iOS simulator build work).

1. Boot-time kills, scripted by this skill:
   `node ${CLAUDE_SKILL_DIR}/scripts/kill-test.mjs --create --app <path/to/App.app> --bundle-id <id> --game-id <game-id> --repo .`
   It creates a simulator named `e07-kill-test`, installs the app, and first calibrates: one undisturbed launch measures when the first save write lands (`save.db-wal` growing after the launch, waited for up to 20 s; none is `slot-missing`). It then launches and SIGKILLs the app 12 times at growing delays spread over 1.5 times that measured moment (the step is at least 80 ms), so several kills land inside the startup writes however slow the start-up is, then copies `save.db` out of the container, inspects it (with `--repo`, both slots are also decoded by the app's own `decodeSlot`), and finally deletes the simulator. Use `--udid <id>` instead of `--create` for an existing dedicated simulator, `--kills` to change the number of rounds and `--step-ms` to fix the step yourself (no calibration then). `--dry-run` prints the plan and ends with exit 2, never `RESULT: PASS`: a plan proves nothing.
2. Mid-level kills: an end-to-end flow plays N moves through the debug hooks, then `xcrun simctl terminate` (or `kill -9`), relaunches, and asserts the Game screen is back, paused, with `moveCount >= N - 1`; then run `inspect-save` on the simulator.
3. Pass criteria: every inspection exits 0 (both slots present and decoding, `save_quarantine` empty) and no launch shows the damaged-save dialog.

The agent's own foreground `sleep` may be blocked; the script waits with `Atomics.wait`, and end-to-end flows use their own waits.

### The kill test on Android

The same test runs on an Android emulator with `--platform android`, against the Release test-variant APK (built by the Android emulator build work):

`node ${CLAUDE_SKILL_DIR}/scripts/kill-test.mjs --platform android --create --app apps/<game-id>/android/app/build/outputs/apk/release/app-release.apk --bundle-id io.applander.<id> --game-id <game-id> --repo .`

- `--create` makes the AVD `e07-android-kill-test` with `avdmanager create avd --name e07-android-kill-test --package "system-images;android-35;google_apis;arm64-v8a" --device pixel_8` (answering `no` to the hardware-profile prompt; an AVD of that name left by a crashed run is reused), starts it headless with `emulator -avd e07-android-kill-test -port <port> -no-snapshot -no-boot-anim -no-audio -no-window` on the first free even console port from 5554, and polls `adb -s emulator-<port> shell getprop sys.boot_completed` every second (up to 4 minutes) until it reads `1`. At the end, also after a failure, it runs `adb -s <serial> emu kill`, waits until `adb devices` no longer lists the serial, and `avdmanager delete avd --name e07-android-kill-test`. `--serial <serial>` uses a running dedicated emulator instead (it must be listed by `adb devices`; never another project's AVD).
- The image must be `google_apis`, never `google_apis_playstore`: the script runs `adb -s <serial> root` and proves it with `adb -s <serial> shell id -u` = `0`; a Play Store image answers "adbd cannot run as root in production builds", and the run stops with exit 2 (root is what lets it read a Release app's private folder without `run-as`, which needs a debuggable build).
- `--app` must be an `.apk` (`adb -s <serial> install -r`, which keeps the app's data like a store update). The package id is the same `io.applander.<game id without hyphens>` as the iOS bundle id, passed as `--bundle-id`.
- Calibration: `am force-stop`, then `stat -c '%s %Y'` of `/data/data/<package>/files/SQLite/save.db-wal`, then `am start -n <package>/.MainActivity`, then the same `stat` every few milliseconds until the WAL exists non-empty or its size or time changed (the device clock is not the Mac's, so before and after are compared; `isAndroidWalWrite`). The step rule is the iOS one (`killStepMs`).
- Each round is `am force-stop` (a cold start) followed by one device shell line that launches, waits and kills on the device, with no adb round trip between launch and kill: `am start -n <package>/.MainActivity >/dev/null 2>&1; sleep <s>; pid=$(pidof <package>); if [ -n "$pid" ]; then kill -9 $pid; ...`. A round whose app had already exited is reported and still counts.
- Then `adb -s <serial> pull /data/data/<package>/files/SQLite/ <tmp>` copies `save.db` with its `-wal` and `-shm` (adb nests the folder inside an existing destination), the copy is inspected exactly like the iOS one (with `--repo`, both slots are decoded by the app's `decodeSlot`), and the copy is deleted.
- Every adb call names its device (`adb -s <serial>`); the SDK is `--sdk`, else `ANDROID_HOME`, else `ANDROID_SDK_ROOT`, else `~/Library/Android/sdk`. A missing `adb`, emulator, avdmanager or (for `--create`) system image stops the run with exit 2 and names the `sdkmanager` package: the script never downloads.
- `--dry-run` prints every command (`would run: ...`, `<serial>` and `<port>` stand for the values a real run finds) and ends with exit 2. The self-test runs the Android path against fake `adb`, `emulator` and `avdmanager` programs (`tests/fixtures/kill-test/fake-sdk/`) that read each case's `scenario.json` and never reach a device; it has not yet run on a real emulator (the first real run is the Android build's kill-test step).

## inspect-save: reading a save.db

`node ${CLAUDE_SKILL_DIR}/scripts/inspect-save.mjs <save.db | dump.sql> --game-id <id> [--max-version <n>]`, or `--udid <id> --bundle-id <id>` to read the installed app's file. It always works on a copy (the app's files are never opened in place), prints one line per slot (`schema`, `writeCount`, bytes, app version) and fails on: `no-save-table`, `slot-missing`, `checksum`, `json`, `schema-version` (payload vs row), `newer-version`, `game-id`, `journal-mode` (not WAL) and `quarantine` (rows present; `--allow-quarantine` after a planned damage test). With `--deep --repo .` it also decodes each slot with the app's own `decodeSlot` (valibot schema and migrations) and reports `decode`. On Android, `--platform android --serial <serial> --bundle-id <package>` runs `adb -s <serial> root` (a google_apis image), pulls `/data/data/<package>/files/SQLite/` into a temporary folder, inspects that copy and deletes it; by hand, `adb -s <serial> root` then `adb -s <serial> pull /data/data/<package>/files/SQLite/ <folder>` and `inspect-save.mjs <folder>/save.db` (or `<folder>/SQLite/save.db` when `<folder>` existed before the pull) do the same.

## What has been verified

On 2026-09-26 with Node 26.4.0, Xcode 26.6, the iOS 26.5 simulator, expo 57.0.25, react-native 0.86.3 (Hermes V1), expo-sqlite 57.0.3 (SQLite 3.50.3), zustand 5.0.15, valibot 1.5.0, TypeScript 6.0.3, Jest 29.7 with jest-expo 57.0.5:

- First launch validated a fresh document with valibot on Hermes and wrote both slots (`writeCount` 1, WAL); relaunch decoded, validated and refreshed the backup.
- With the saved language set to `fa`, exactly one write happened after the direction reload, and none before it.
- App to background: `save.db-wal` went from 4-16 KB to 0 bytes.
- Ten and twelve `kill -9` at growing delays during the startup writes: both slots always decoded, no quarantine rows.
- `node:sqlite` loads without a flag on Node 26 and works inside jest-expo's environment; its rows need the `{ ...row }` copy.
- On 2026-09-28 the templates in this skill passed `tsc`, the project ESLint config, Prettier and Jest together with the state-store and daily templates, and the v2 example passed the same checks on top of them.
- On 2026-09-28 `kill-test.mjs --create` ran on Xcode 26.6 with the iOS 26.5 runtime against an unrelated Release app: it created its throwaway simulator (then named `pa-kill-test`; since 2026-09-30 every tool names its simulators `e07-<purpose>`, so it is `e07-kill-test`), installed, launched and SIGKILLed the app 3 times, failed the inspection as it should (that app writes no `save.db`), and deleted the simulator; a launch failure right after creation also deleted it. On 2026-10-04 the first run against a Pocket Arcade Release build (Line Siege, test variant, Xcode 26.6, iOS 26.5) showed why the kills need calibration: `simctl launch` returned after about 200 ms, and the app opened `save.db` about 1,000 ms after that, so the old fixed window (80 ... 960 ms) killed every launch before any write and ended `slot-missing`. With calibration (first write measured at 1,406 ms on the fresh simulator, step 176 ms, rounds up to 2,112 ms) it passed: both slots decoded, `writeCount` 7, no quarantined row.
