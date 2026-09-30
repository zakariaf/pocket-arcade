# Diagnosing a failure nobody has seen yet, and recording it

Read this when `find-fix.mjs` printed `no-known-fix`, or when a catalogue fix did not work. It is the method, the places to look, the stop rules and the exact shape of a new catalogue entry.

## Contents

- The loop
- Where the evidence is
- Isolating the cause
- Stop and ask the owner
- Writing the entry
- Worked example

## The loop

1. **Capture the exact text.** Copy the first error line, not the last one: in xcodebuild and Jest output the first error is usually the cause and the rest follow from it. Keep the command that produced it.
2. **Look it up again with less noise.** Run `find-fix.mjs --text "<the one distinctive line>"`, then with two or three plain words that describe what you see ("banner never appears", "store build debug menu"). A log file goes in with `--log <file>`; only error patterns are matched there.
3. **Read the area reference** for the step that failed (build, release, lint, testing ...). Rows marked `open` often explain behaviour that is not a bug in our code.
4. **Isolate** (next sections): reproduce once, change one thing, reproduce again.
5. **Fix the cause.** Never the check: no widened tolerance, no skipped test, no `eslint-disable`, no lowered limit, no deleted assertion. A gate change needs the owner and a `Gate-Change:` trailer.
6. **Verify** with the command that failed, then the full gate of that area (`npm run -s check:fast`, `npm run verify`, the simulator build, the release gate).
7. **Record** the failure as a catalogue entry (below), run `check-catalogue.mjs --write`, then `check-catalogue.mjs`, and, if the failure is visible in repo files before it happens, add a rule to `scripts/lib/pitfalls.mjs` with a planted-bug fixture.

## Where the evidence is

| Step | Where the full output is |
|---|---|
| Simulator build (`npm run build:ios:sim`) | `apps/<game>/build/logs/<step>.log` (prebuild, xcodebuild, install, launch); the screenshot in `reports/ios/<game>/` |
| Release (`npm run release:ios`) | `apps/<game>/build/logs/<step>.log` (prebuild, archive, export, validate, upload); the message the run printed is already matched against the release failure table |
| App at runtime on the simulator | `xcrun simctl spawn <udid> log show --last 2m --predicate 'process == "<Executable>"'`; in a test build the debug menu's error log |
| Jest | the first `●` block of the failing suite; run one file with `npx jest <path>` |
| TypeScript | `npm run -s typecheck`; the error code (`TS2593`, `TS4111` ...) is the fastest lookup key |
| ESLint | `npx eslint <file> --max-warnings 0`; the rule id in the last column |
| Maestro | the flow output and `~/.maestro/tests/<run>/` (screenshots of the failing step) |
| Metro bundle content | `grep -a -c <text> <App>.app/main.jsbundle` (strings survive Hermes bytecode) |
| Built app settings | `plutil -p <App>.app/Info.plist`, `plutil -p <App>.app/EXConstants.bundle/app.config` |

## Isolating the cause

- **Reproduce once, cleanly.** Build problems: clean prebuild (`npx expo prebuild --platform ios --clean`) and the same env variables. Test problems: the one test file alone.
- **Change one thing at a time** and write down each attempt (what changed, what happened). Two changes at once hide which one mattered.
- **Suspect the newest change first:** a dependency bump, a config edit, a new file in a gated path. `git diff`, `git log -p -1 -- <file>`.
- **Suspect the environment second:** the Xcode that ran (`xcodebuild -version` under the same `DEVELOPER_DIR`), the Node version (`node -v`, 26.4.0 expected), a stale Metro cache (the variant key), a simulator another task changed.
- **Make a minimal repro in a scratch copy** when the cause is inside a library: a copy of the repo (never the real one) with the smallest change that still fails. Read the library's installed source in `node_modules/<pkg>` before trusting its docs; versions here are newer than most documentation.
- **Stop after three failed hypotheses** and report what was tried; the owner would rather hear "stuck, here is the evidence" than see a workaround.

## Stop and ask the owner

Stop, send one message (the step, the exact error line, the one action needed) and wait, whenever the fix needs:

- a password, `sudo`, the keychain, an Apple or Google account, a console (App Store Connect, AdMob), an agreement, or the owner's device;
- a change to a quality gate, a limit, a tolerance or a golden file;
- a product decision (anything in the open-risks reference marked owner);
- anything outward-facing or irreversible: uploading, tagging, pushing, submitting, deleting data that is not scratch.

Never retry a stop in a loop: keychain, 401/403 and agreement errors can lock the account or burn build numbers.

## Writing the entry

Add one object to `entries` in `assets/known-failures.json`. Never edit the rendered `references/<area>.md` files by hand; `check-catalogue.mjs --write` renders them.

| Field | Rule |
|---|---|
| `id` | `<area>-<what-failed>`, kebab-case, unique (for example `build-metro-cache-variant`) |
| `area` | one of the keys in `areas` (build, release, deps, lint, testing, engine, i18n, services, state, parity, gates, perf, skills, open) |
| `topic` | a short group heading inside the area (reuse an existing topic when one fits) |
| `symptom` | what you see, as close to the literal error text as possible, so a later search finds it |
| `cause` | why it happens, in one sentence |
| `fix` | the action that fixes the cause, specific enough to do without re-diagnosing |
| `match` | regular expressions (JSON-escaped: `"ITMS-9018\\d"`) that match the error text in a log; `[]` when there is no stable text. Keep them specific: a pattern that matches ordinary log lines floods every lookup |
| `status` | `verified` (seen and fixed in a real run), `documented` (read in the tool's source or docs, not reproduced), `open` (not settled: the fix is the current fallback or decision) |
| `owner` | `true` when the fix needs the owner (a stop) |
| `skill` | the skill that owns the full procedure, or `null` |

When an `open` entry gets settled, change its status and its fix; do not add a second entry.

## Worked example

A store simulator build showed the debug menu. `find-fix.mjs --text "store build shows debug menu"` found nothing (before this entry existed). The loop:

1. `grep -a -c SHELL_TEST_BUILD_ONLY <App>.app/main.jsbundle` printed 1 in the store build: test code shipped.
2. A store build right after a clean Metro cache printed 0; after a test build it printed 1. Cause isolated: the cache, not the gate.
3. Fix: `config.cacheVersion` keyed on `EXPO_PUBLIC_APP_VARIANT` in `metro.config.js`; proved by a back-to-back test then store build.
4. Entry:

```json
{
  "id": "build-metro-cache-variant",
  "area": "build",
  "topic": "Variants",
  "symptom": "A store build still contains the debug module or shows variant=test (sentinel SHELL_TEST_BUILD_ONLY in main.jsbundle)",
  "cause": "Metro inlines EXPO_PUBLIC_* at transform time but does not key its cache on them",
  "fix": "config.cacheVersion = `app-variant-${process.env.EXPO_PUBLIC_APP_VARIANT ?? 'test'}` in every app's metro.config.js; prove with a back-to-back test and store build",
  "match": ["SHELL_TEST_BUILD_ONLY", "store build contains"],
  "status": "verified",
  "owner": false,
  "skill": "ios-simulator-build"
}
```

5. Because the cause is visible in a file, `pitfalls.mjs` got the rule `build-metro-cache-variant` (a `metro.config.js` without the key) and the `bad-variants` fixture plants it.
