# The 7-day release-age policy and dated exceptions

How `.npmrc` keeps brand-new releases out, how npm 11.17 behaves with it, and the only allowed way to take a release younger than 7 days. Read it when an install fails with `ETARGET`/`notarget`, when adding an exception, and on or after an exclude block's expiry date.

## Contents

- The complete root .npmrc
- How the policy behaves (verified)
- Why the bootstrap block existed
- Adding a dated exception
- Expiry: delete, never extend
- A new Expo patch inside the 7 days
- What checks it

## The complete root .npmrc

```ini
# Refuse to resolve any version published less than 7 days ago.
min-release-age=7
# Refuse to install when node/npm do not satisfy package.json "engines".
engine-strict=true
# Never let npm guess ranges: every `npm install <pkg>` writes an exact version.
save-exact=true

# exclude-block expires=2026-10-03 reason=bootstrap of the set verified on 2026-09-26 (dependency-management versions table)
min-release-age-exclude[]=expo
min-release-age-exclude[]=expo-*
min-release-age-exclude[]=@expo/*
min-release-age-exclude[]=babel-preset-expo
min-release-age-exclude[]=react-native-audio-api
min-release-age-exclude[]=react-native-google-mobile-ads
min-release-age-exclude[]=prettier
min-release-age-exclude[]=knip
min-release-age-exclude[]=fast-check
min-release-age-exclude[]=react-intl
min-release-age-exclude[]=intl-messageformat
min-release-age-exclude[]=@formatjs/*
min-release-age-exclude[]=eslint-plugin-formatjs
```

- `min-release-age=7`: a 7-day wait lets most malicious or broken releases be pulled before we adopt them.
- `engine-strict=true` with `engines.npm >=11.17.0`: npm 11.17.0 is the first release that reads `min-release-age-exclude`; an older npm silently ignores the excludes (the install then fails with `ETARGET`), and older releases ignore the age policy itself.
- `save-exact=true`: `npm install x@~3.0.0` saved `"3.0.1"` (verified); every change of a version becomes a deliberate, reviewed commit.
- npm reads no inline comments: the reason of a block goes on its own `#` line.
- npm keeps the **last** value of a key (verified: `min-release-age=7` followed by `min-release-age=0` gives 0) and reads `key = value` like `key=value`, and `min-release-age-exclude = x` like `min-release-age-exclude[]=x`. So the policy lines appear once, and every exclude, in any spelling, sits inside a dated block; the checks fail (`policy-overridden`, `no-block`) otherwise. A comment line that still reads `# exclude-block expires=YYYY-MM-DD …` is documentation, not a block.

## How the policy behaves (verified)

Verified with npm 11.17.0 on 2026-09-26:

- A fresh resolution of a too-young version fails: `npm error notarget No matching version found for <pkg>@<v> with a date before <now - 7 days>`.
- A range picks the newest version that is at least 7 days old: `react-native-google-mobile-ads@^17` resolved to 17.0.0; `prettier@^3.9.0` to 3.9.8.
- An exclude exempts only the named package or glob: "its own dependencies still follow the release-age policy". That is why `@expo/*` is listed next to `expo`.
- A glob exclude is a door for every future release under that name, not only the version you needed. On 2026-09-29 the `@typescript-eslint/*` glob (then in the bootstrap block) let a one-day-old `@typescript-eslint/eslint-plugin` 8.71.0 into a fresh install through `eslint-config-expo`'s `^8.59.0` range, next to `typescript-eslint` 8.70.1's own 8.70.1: every ESLint run crashed with `Cannot redefine plugin "@typescript-eslint"`. So `typescript-eslint` and `@typescript-eslint/*` left the block (8.70.1 is 7 days old from 2026-09-29), and the root `overrides` pin all ten `@typescript-eslint/*` packages at 8.70.1. A dated exclude therefore names exact packages wherever it can, and a pinned package whose dependents float gets root overrides as well.
- `npm ci`, and `npm install` with an existing lockfile, install the locked versions without re-checking age. The policy acts at the moment a version enters `package-lock.json`: when a dependency is added or upgraded.
- CocoaPods has no age gate; pods follow the npm pins, and the vendor-pod allowlist of the network audit catches a new vendor pod.

## Why the bootstrap block existed

Several verified versions were younger than 7 days on 2026-09-26: `expo` 57.0.25 (2 days, and it pulls `@expo/cli ^57.0.27`), `expo-build-properties` 57.0.22 and `babel-preset-expo` 57.0.13 (2 days), `react-native-audio-api` 0.13.6 (3 days), `react-native-google-mobile-ads` 17.2.0 and `react-intl` 12.1.3 (1 day), `expo-iap` 5.8.0 (0 days, covered by `expo-*`), typescript-eslint 8.70.1 (4), Prettier 3.9.9 and knip 6.38.0 (3), fast-check 4.10.2 (6), and the FormatJS packages. A resolution of that set with `min-release-age=7` fails with `ETARGET`. Each of the original 15 patterns was proven necessary by removal; the two typescript-eslint patterns were removed on 2026-09-29 (above), so the block holds 13. The block expires on 2026-10-03, the day the youngest package (`expo-iap` 5.8.0) turns 7.

## Adding a dated exception

Only for a fix the project needs before the release is 7 days old, and only with the owner's agreement:

1. `node ${CLAUDE_SKILL_DIR}/scripts/plan-dependency.mjs <pkg>@<version> --root . --online` shows the publish date and the day it turns 7.
2. Copy `templates/npmrc-exclude-block.txt`, fill `__EXPIRES__` with publish date + 7 days, `__REASON__` with the issue link or changelog line, and `__PACKAGE__` with the exact name (add a separate line per extra name or glob, as few as possible). Paste it at the end of `.npmrc`, separated by one blank line (a blank line ends a block).
3. Install, then commit with a body that says why and a `Gate-Change:` trailer (`.npmrc` is a gated path).

## Expiry: delete, never extend

On or after the `expires=` date the whole block is deleted, not moved forward. Nothing reinstalls: the lockfile keeps the versions. `packages/tooling/src/deps/check-deps.ts` (the last step of `npm run verify`) and `check-deps-policy.mjs` fail on:

- `expired`: an exclude inside a block whose date has passed;
- `no-block`: an exclude outside a `# exclude-block expires=YYYY-MM-DD reason=…` block;
- `policy-missing` / `npmrc-policy`: a missing `min-release-age=7`, `engine-strict=true` or `save-exact=true`;
- `policy-overridden` / `npmrc-policy`: a later line that sets one of those keys to another value.

## A new Expo patch inside the 7 days

Expo's own checks compare the installed SDK packages with the newest patch of the SDK line, whatever its age. On 2026-09-29 `expo` 57.0.26 and `expo-constants` 57.0.20 were published at 10:56 UTC, and three hours later `npx expo install --check` printed `expo@57.0.25 - expected version: ~57.0.26` and `expo-doctor` reported a patch version mismatch, with no change to the repo. Installing the patch that day would break `min-release-age=7`, and a dated exception for a routine patch is not worth an owner question. So:

- `check-deps.ts` asks npm when each expected version was published (`npm view <pkg> time --json`). When every mismatch is a later patch of the same `major.minor` line and younger than 7 days, it prints one `WARN` line per package with the day it becomes due (the first UTC day at least 7 days after publication; 2026-10-07 for a patch published 2026-09-29) and passes. Any other mismatch, an unknown publish time, or any other failing expo-doctor check still fails.
- On the due date the same mismatch fails. Then follow the upgrade procedure in `references/procedures.md`: `npx expo install <pkg>@~<version>` in every app, the versions-table row, the root override if the package has one (`expo` has), `npm install`, one commit.
- Never add an exclude for such a patch and never install it early; never pass `--fix` to Expo's checks inside the 7 days.
- A bare `npx expo install <pkg>` writes such a patch too (it wrote `~57.0.20` for `expo-constants` on 2026-09-29, and the bootstrap block let `expo-*` through). Always install Expo-managed packages with the table spec, `npx expo install <pkg>@<table spec>`; `check-deps-policy.mjs` prints that command when a manifest already holds the newer specifier (`expo-spec`, `table-version`).

`expo-patch-age.ts` (next to `check-deps.ts`, with its tests) holds the rule: the parsers for both outputs, `dueDay`, and `judgeMismatches`.

## What checks it

| Check | Where | Fails on |
|---|---|---|
| `release-age-excludes.ts` via `check-deps.ts` | `npm run verify` (and the pre-push hook) | undated or expired excludes, missing policy line |
| `expo-patch-age.ts` via `check-deps.ts` | `npm run verify` | an Expo patch mismatch once its expected version is 7 days old (a `WARN` line with the due date before that) |
| the guardrail `check-quality-gates.ts` | `npm run verify` | a missing policy line (`npmrcLines` in `quality-gates.json`) |
| `check-deps-policy.mjs` (this skill) | whenever dependencies change | all of the above, plus malformed block headers |
| `plan-dependency.mjs --online` (this skill) | before installing | a version younger than 7 days that no active block covers |
