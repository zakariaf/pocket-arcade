# 16 · Quality gates, hooks and CI

> **What this doc decides.** The exact command behind every canonical npm script; the order and cost of `npm run verify`; the git hooks (`lefthook.yml`), the Claude Code hooks and permissions (`.claude/settings.json`), the guardrail that stops gates from being weakened (`quality-gates.json`), `knip.json`, the supply-chain checks (release-age cooldown, reviewed install scripts, licence audit) and the optional GitHub Actions workflow.
> The rule behind all of it: when a gate fails, fix the code. Never weaken a gate; if a gate looks wrong, stop and ask the owner.
> Config style and limits are in [04-code-style-and-limits.md](04-code-style-and-limits.md), naming and the commit format in [03-naming.md](03-naming.md).
> **Related docs:** [03-naming.md](03-naming.md) (commit format), [04-code-style-and-limits.md](04-code-style-and-limits.md) (ESLint and tsconfigs), [01-stack-and-versions.md](01-stack-and-versions.md) (.npmrc and freshness), [07-testing-and-tdd.md](07-testing-and-tdd.md) (Jest, Stryker, Maestro), [13-privacy-network-security.md](13-privacy-network-security.md) (network and privacy audits), [14-ios-build-and-release.md](14-ios-build-and-release.md) (build and release scripts). Start at [00-README.md](00-README.md); how a session works is [17-claude-code-playbook.md](17-claude-code-playbook.md).

## Intro

There is no human reviewer, so quality is a stack of automatic gates, each cheaper and earlier than the next:

| When | Gate | Blocks | Typical time |
|---|---|---|---|
| After every Edit/Write by Claude | PostToolUse hook: Prettier + ESLint on that file | nothing (feeds errors back to Claude, exit 2) | ~5 s |
| When Claude wants to stop | Stop hook: `npm run check:fast` | Claude from stopping (exit 2) | ~7 s |
| `git commit` | lefthook `pre-commit`: secrets, format, lint, typecheck, related tests (parallel) | the commit | ~4 s |
| `git commit` | lefthook `commit-msg`: Conventional Commits + `Gate-Change:` trailer | the commit | 0.1 s |
| `git push` | lefthook `pre-push`: `npm run verify` | the push | minutes |
| Nightly / manual (optional) | GitHub Actions `static` and `ios-e2e` | merge (if the owner uses PRs) | 5-60 min |
| Every `verify` | guardrail: resolved configs equal `quality-gates.json` | the push | ~30 s |

End-to-end (`e2e:ios`, `screenshots:ios`) and mutation testing (`test:mutation`) are outside `verify` (FINAL F) and run nightly, before a release, and when a rules module is finished.

## Rules

1. **Use the canonical scripts exactly as defined in section 1** and no ad-hoc variants in hooks or CI (FINAL F).
   *Why:* the guardrail compares the gate scripts byte for byte; a weaker copy elsewhere would bypass it.
2. **Run `npm run check:fast` before saying a change is done, and `npm run verify` before every push** (the pre-push hook does it).
   *Source:* FINAL D.41, D.42.
3. **Never bypass a hook**: no `--no-verify`, no `-n`, no `LEFTHOOK=0` locally, no `core.hooksPath` tricks.
   *Why:* hooks are the only reviewer. *Enforced by:* `.claude/settings.json` deny rules for the common forms; the pre-push `verify` re-runs everything.
4. **Start Claude Code at the repository root.** Hooks and permissions load only from the `.claude/settings.json` of the directory the session starts in (no parent fallback).
   *Source:* [Claude Code permissions: working directories](https://code.claude.com/docs/en/permissions).
5. **Keep `.claude/settings.json` merged with the Expo template's file**: keep its keys (`enabledPlugins`), add `permissions` and `hooks`.
   *Source:* FINAL D.42.
6. **Hooks that must reach Claude exit with code 2 and write to stderr.** Exit 1 is a non-blocking error Claude never sees.
   *Source:* [Claude Code hooks: exit code 2 behavior](https://code.claude.com/docs/en/hooks).
7. **Change a gate only with the owner's agreement**, in one commit that changes the gate *and* `quality-gates.json`, with a `Gate-Change: <reason>` trailer. Gated paths are listed in `quality-gates.json` → `gatedPaths`.
   *Enforced by:* the `commit-msg` hook, the guardrail and the `ask` permission rules.
8. **Pin every dependency exactly** (`.npmrc` `save-exact=true`), commit `package-lock.json`, and install in CI with `npm ci`.
   *Source:* FINAL D.43.
9. **Respect the 7-day release-age cooldown** (`min-release-age=7`). Exemptions live only in a dated block `# exclude-block expires=YYYY-MM-DD reason=…` in the root `.npmrc`, which docs/01 owns; `verify` fails on an undated or expired exclude.
   *Source:* [npm config: min-release-age](https://docs.npmjs.com/cli/v11/using-npm/config#min-release-age); docs/01 section 3.4.
10. **Approve install scripts explicitly** with `npm approve-scripts <pkg>` after reading what the script does; `verify` fails while any package has unreviewed install scripts.
    *Source:* [npm approve-scripts](https://docs.npmjs.com/cli/v11/commands/npm-approve-scripts).
11. **Ship only dependencies under MIT, ISC, Apache-2.0, BSD-2/3-Clause, 0BSD, OFL-1.1 or CC0-1.0**; anything else needs an entry in `packages/tooling/license-exceptions.json` (a gated path) with the licence and the reason.
    *Enforced by:* `npm run audit:licenses`. *Source:* FINAL D.43.
12. **When a gate fails, fix the code; never weaken the gate.** If you believe the gate itself is wrong, stop and ask the owner (section 11).
    *Source:* FINAL D.41.

## Details

### 1. Canonical npm scripts

All scripts live in the root `package.json` and run from the repo root. Game-specific scripts take `-- --app <game-id>` (and `--variant test|store` where docs/14 says so).

```json
"scripts": {
  "prepare": "lefthook install",
  "verify": "npm run -s format:check && npm run -s lint && npm run -s typecheck && npm run -s i18n:verify && npm run -s knip && node packages/tooling/src/quality/check-quality-gates.ts && npm run -s test:coverage && npm run -s test:sim && npm run -s audit:network && npm run -s audit:licenses && node packages/tooling/src/deps/check-deps.ts",
  "check:fast": "prettier --check . --log-level warn && eslint . --max-warnings 0 --cache --cache-strategy content --cache-location node_modules/.cache/eslint/ && npm run -s typecheck && jest --ci --onlyChanged --passWithNoTests",
  "format": "prettier --write . --log-level warn",
  "format:check": "prettier --check . --log-level warn",
  "lint": "eslint . --max-warnings 0",
  "typecheck": "tsc --noEmit -p tsconfig.json && for project in packages/* apps/*; do tsc --noEmit -p \"$project\" || exit 1; done",
  "test": "jest --ci",
  "test:golden": "jest --ci --selectProjects golden",
  "test:sim": "jest --ci --config jest.sim.config.js",
  "test:coverage": "jest --ci --coverage --randomize",
  "test:mutation": "stryker run",
  "knip": "APP_VARIANT=test ADS_MODE=off knip",
  "audit:network": "node packages/tooling/src/audit/audit-network.ts",
  "audit:privacy": "node packages/tooling/src/audit/audit-privacy.ts",
  "audit:licenses": "node packages/tooling/src/audit/audit-licenses.ts",
  "i18n:verify": "node packages/tooling/src/i18n/verify-catalogs.ts",
  "e2e:ios": "node packages/tooling/src/e2e/run-e2e-ios.ts",
  "screenshots:ios": "node packages/tooling/src/e2e/capture-screenshots-ios.ts",
  "build:ios:sim": "node packages/tooling/src/build/build-ios-sim.ts",
  "release:ios": "node packages/tooling/src/release/release-ios.ts",
  "new-game": "node packages/tooling/src/scaffold/new-game.ts"
}
```

| Script | What it does | Needs |
|---|---|---|
| `prepare` | installs the git hooks (`lefthook install`); npm runs it after `npm install`/`npm ci` | git repo |
| `verify` | everything except E2E and mutation, cheapest first (section 2) | network (dependency checks) |
| `check:fast` | Prettier check, ESLint (cached), all `tsc` projects, tests related to uncommitted changes | git repo |
| `format` / `format:check` | Prettier write / check on the whole repo | |
| `lint` | ESLint on the whole repo, **no cache** (type-aware results can go stale in a cache) | |
| `typecheck` | root `tsconfig.json`, then `tsc -p` for every `packages/*` and `apps/*`; errors print repo-relative paths | |
| `test` | all Jest projects (`unit`, `golden`), `--ci` never writes snapshots | |
| `test:golden` | only the `golden` project | |
| `test:sim` | bot and balance simulations (`*.sim.test.ts`), own config | |
| `test:coverage` | all Jest projects with coverage thresholds, random order | |
| `test:mutation` | StrykerJS on logic folders (nightly / pre-release) | |
| `knip` | unused files, exports, dependencies; sets `APP_VARIANT=test ADS_MODE=off` because knip evaluates `app.config.ts` | |
| `audit:network` | spec N3 static layers for every app; writes each export to `dist-audit/<game-id>/` | Expo CLI |
| `audit:licenses` | licence of every npm package in the exported bundles (reads `dist-audit/`) | run after `audit:network` |
| `audit:privacy` | aggregates `ios/Pods/**/PrivacyInfo.xcprivacy` against `app.config.ts` | macOS, after prebuild + pod install |
| `i18n:verify` | FormatJS `verify` + the catalog linter for Shell and game catalogs | |
| `e2e:ios`, `screenshots:ios` | Maestro flows and the screenshot matrix on a Release simulator build | macOS, simulator, Java 17 |
| `build:ios:sim`, `release:ios` | local `xcodebuild` pipelines (FINAL A.9) | macOS, Xcode |
| `new-game` | scaffolds `apps/<game-id>` | |

FINAL F puts every gate except E2E and mutation into `verify`. Two scripts are gates but run elsewhere: `audit:privacy` needs `ios/Pods` (prebuild + `pod install` on macOS), so `build:ios:sim` and `release:ios` run it right after prebuild (docs/14), together with the pod layers of `audit:network`; `test:golden` is already inside `test:coverage`. `build:ios:sim`, `release:ios`, `screenshots:ios` and `new-game` are tools, not gates.

The implementation files behind `audit:*`, `i18n:verify` (docs/10), `e2e:ios`, `screenshots:ios`, `build:ios:sim`, `release:ios` (docs/14) and `new-game` belong to the docs for those areas; the paths above are the contract. `audit:licenses`, `check-quality-gates.ts`, `check-deps.ts`, `check-commit-message.ts` and `after-edit.ts` are defined in this doc.

### 2. The verify pipeline

Order is cheapest-and-most-likely-to-fail first; `&&` stops at the first failure.

| # | Step | Measured 2026-09-26 (sample repo) | Expected with the Shell + pilot game | Fails when |
|---|---|---|---|---|
| 1 | `format:check` | 0.6-1.4 s | ~2 s | a file is not Prettier-formatted |
| 2 | `lint` | 3.6 s | 15-40 s | any ESLint error or warning |
| 3 | `typecheck` | 2 s warm, ~5 s cold | 5-15 s | any `tsc` error in any project |
| 4 | `i18n:verify` | not built yet | ~2 s | missing/extra keys, ICU mismatch, bad key names |
| 5 | `knip` | 1.4 s | ~3 s | unused file, export, dependency; unlisted dependency |
| 6 | guardrail `check-quality-gates.ts` | 29 s | ~30 s | a resolved config differs from `quality-gates.json` |
| 7 | `test:coverage` | 2-13 s | 30-120 s | a failing test or a coverage threshold |
| 8 | `test:sim` | not built yet | 1-10 min | a bot or balance property fails |
| 9 | `audit:network` | 7.2 s export + 5.6 s native scan per app (probe) | ~15 s per app | a new network-capable path |
| 10 | `audit:licenses` | < 1 s (52 packages in the probe bundle) | < 1 s | a shipped package without an allowed licence |
| 11 | `deps/check-deps.ts` | 4.9 s on the sample repo (its toy app fails `expo install --check`, so not representative) | ~10-20 s per app | an undated or expired release-age exclude, apps out of lockstep, `expo install --check` or `expo-doctor` failing, or an unreviewed install script |

`check-deps.ts` is the dependency gate that docs/01 requires inside `verify` (its rules 5, 6, 8 and 12). It needs the network (Expo's version API and npm); offline, `verify` fails at step 11, which is correct, since a push without the dependency checks would be unverified. Set `EXPO_NO_TELEMETRY=1` in tooling environments (docs/01).

```ts
// packages/tooling/src/deps/check-deps.ts
// The dependency gate of `npm run verify` (docs/01 rules 5, 6, 8, 12; docs/16 section 2):
// dated release-age excludes, app lockstep, Expo alignment per app, reviewed install scripts.
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { todayIso } from '@e07/tooling/clock/system-clock.ts';

import { findLockstepDrift, type AppManifest } from './app-lockstep.ts';
import { checkReleaseAgeExcludes } from './release-age-excludes.ts';

const NO_PENDING = 'No packages with unreviewed install scripts.';

type Run = { readonly ok: boolean; readonly output: string };

function run(command: string, args: readonly string[], cwd: string): Run {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
  return { ok: result.status === 0, output: `${result.stdout}${result.stderr}` };
}

function releaseAgeProblems(): readonly string[] {
  const violations = checkReleaseAgeExcludes(readFileSync('.npmrc', 'utf8'), todayIso());
  return violations.map((violation) =>
    `.npmrc line ${String(violation.line)}: ${violation.problem} ${violation.pattern}`.trim(),
  );
}

function lockstepProblems(apps: readonly string[]): readonly string[] {
  const manifests = new Map<string, AppManifest>(
    apps.map((app) => {
      const file = path.join('apps', app, 'package.json');
      return [app, JSON.parse(readFileSync(file, 'utf8')) as AppManifest];
    }),
  );
  return findLockstepDrift(manifests);
}

function expoProblems(apps: readonly string[]): readonly string[] {
  return apps.flatMap((app) => {
    const cwd = path.join('apps', app);
    const checks: readonly [string, readonly string[]][] = [
      ['expo install --check', ['expo', 'install', '--check']],
      ['expo-doctor', ['expo-doctor']],
    ];
    return checks
      .map(([label, args]) => ({ label, result: run('npx', args, cwd) }))
      .filter(({ result }) => !result.ok)
      .map(({ label, result }) => `${app}: ${label} failed\n${result.output}`);
  });
}

function installScriptProblems(): readonly string[] {
  const pending = run('npm', ['approve-scripts', '--allow-scripts-pending'], '.');
  return pending.output.includes(NO_PENDING)
    ? []
    : [`review install scripts, then run npm approve-scripts <pkg>\n${pending.output}`];
}

function main(): number {
  const apps = readdirSync('apps');
  const problems = [
    ...releaseAgeProblems(),
    ...lockstepProblems(apps),
    ...expoProblems(apps),
    ...installScriptProblems(),
  ];
  for (const problem of problems) {
    console.error(`check-deps: ${problem}`);
  }
  return problems.length === 0 ? 0 : 1;
}

process.exitCode = main();
```

The lockstep check (docs/01 rule 6: every app declares the same version of every shared package):

```ts
// packages/tooling/src/deps/app-lockstep.ts

export type AppManifest = {
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
};

function versionsByPackage(
  manifests: ReadonlyMap<string, AppManifest>,
): ReadonlyMap<string, ReadonlyMap<string, string>> {
  const byPackage = new Map<string, Map<string, string>>();
  for (const [app, manifest] of manifests) {
    const all = { ...manifest.dependencies, ...manifest.devDependencies };
    for (const [name, version] of Object.entries(all)) {
      const versions = byPackage.get(name) ?? new Map<string, string>();
      versions.set(app, version);
      byPackage.set(name, versions);
    }
  }
  return byPackage;
}

/**
 * Lists every package that two apps declare with different version specifiers
 * (docs/01 rule 6: all apps move in lockstep). Workspace links ("*") are ignored.
 */
export function findLockstepDrift(manifests: ReadonlyMap<string, AppManifest>): readonly string[] {
  return [...versionsByPackage(manifests)].flatMap(([name, versions]) => {
    const distinct = new Set([...versions.values()].filter((version) => version !== '*'));
    if (distinct.size <= 1) {
      return [];
    }
    const detail = [...versions].map(([app, version]) => `${app}=${version}`).join(', ');
    return [`${name} differs between apps: ${detail}`];
  });
}
```

```ts
// packages/tooling/src/deps/app-lockstep.test.ts
import { findLockstepDrift, type AppManifest } from './app-lockstep.ts';

describe('findLockstepDrift', () => {
  it('accepts apps that share every version', () => {
    const manifests = new Map<string, AppManifest>([
      ['line-siege', { dependencies: { expo: '57.0.25', '@e07/shell': '*' } }],
      ['flock-tilt', { dependencies: { expo: '57.0.25', '@e07/shell': '*' } }],
    ]);
    expect(findLockstepDrift(manifests)).toStrictEqual([]);
  });

  it('reports a package pinned differently in two apps', () => {
    const manifests = new Map<string, AppManifest>([
      ['line-siege', { dependencies: { expo: '57.0.25' } }],
      ['flock-tilt', { dependencies: { expo: '57.0.24' } }],
    ]);
    expect(findLockstepDrift(manifests)).toStrictEqual([
      'expo differs between apps: line-siege=57.0.25, flock-tilt=57.0.24',
    ]);
  });
});
```

`release-age-excludes.ts` (the dated-exclude check) and `clock/system-clock.ts` (`todayIso()`, the one tooling module that reads the wall clock) are defined in docs/01 section 3.4; `check-deps.ts` only calls them.

### 3. `check:fast`

`check:fast` is the inner loop and the Stop hook's command: Prettier check, ESLint with a content-based cache in `node_modules/.cache/eslint/`, the full `typecheck` (incremental), and `jest --onlyChanged` (tests related to files changed since the last commit). It took 6.6 s on the sample repo. The ESLint cache is safe here because `lint` (no cache) runs again in `verify`.

### 4. Git hooks: `lefthook.yml`

```yaml
# lefthook.yml: git hooks for the monorepo (lefthook 2.x). Owned by docs/16-quality-gates-hooks-ci.md.
# Installed by `npm install` through the root "prepare" script. Never bypass with --no-verify.
assert_lefthook_installed: true
output:
  - summary
  - failure

pre-commit:
  parallel: true
  jobs:
    - name: no-secrets
      glob:
        - '*.p8'
        - '*.p12'
        - '*.mobileprovision'
        - '*.keystore'
        - '*.jks'
        - 'AuthKey_*'
        - '**/AuthKey_*'
        - 'ApiKey_*'
        - '**/ApiKey_*'
        - '.env*'
        - '**/.env*'
      run: echo "Refusing to commit a secret or signing file:" {staged_files} >&2; exit 1
    - name: format
      glob: '*.{ts,tsx,js,mjs,cjs,json,md,yml,yaml}'
      run: npx prettier --check {staged_files}
    - name: lint
      glob: '*.{ts,tsx,js,mjs,cjs}'
      run: npx eslint --max-warnings 0 --no-warn-ignored {staged_files}
    - name: typecheck
      glob: '*.{ts,tsx,json}'
      run: npm run -s typecheck
    - name: test-related
      glob: '*.{ts,tsx,json}'
      run: npx jest --ci --bail --findRelatedTests --passWithNoTests {staged_files}

commit-msg:
  jobs:
    - name: commit-message
      run: node packages/tooling/src/git/check-commit-message.ts {1}

pre-push:
  jobs:
    - name: verify
      run: npm run verify
```

- `pre-commit` jobs run in parallel on the staged files; lefthook's default glob matcher matches nested paths with `*.{ts,tsx}` (verified). Measured: 3.6-4.2 s for a commit of the whole sample repo.
- `no-secrets` refuses any staged signing file or App Store Connect key (FINAL A.10). The `.gitignore` also lists them; the hook catches `git add -f`. Each name pattern appears with and without `**/`: lefthook's default matcher needs a `/` before `**/.env*`, so without the bare `.env*` a root `.env` slipped through (verified with lefthook 2.1.14).
- `typecheck` runs the whole-project script rather than `tsc` on staged files, because a change in one file can break another.
- `commit-msg` runs the checker below; `pre-push` runs the full `verify`.
- `assert_lefthook_installed: true` makes lefthook fail loudly if the hooks were not installed.

The complete root `.gitignore` (it includes the entries docs/07, docs/09 and docs/14 require; add new generated folders here):

```gitignore
node_modules/
.expo/
expo-env.d.ts
apps/*/ios/
apps/*/android/
apps/*/build/
apps/*/dist/
apps/*/sfx-preview/
coverage/
reports/
dist-audit/
/tools/
.stryker-tmp/
**/__image_snapshots__/__diff_output__/
.DS_Store
*.p8
*.p12
*.mobileprovision
*.keystore
*.jks
AuthKey_*
ApiKey_*
*.xcarchive
*.ipa
.env*
.claude/settings.local.json
```

### 5. The commit-msg check

The rules module is in docs/03 section 14 (`commit-message-rules.ts` and its test). The CLI that lefthook calls reads the message, the staged files and `gatedPaths`:

```ts
// packages/tooling/src/git/check-commit-message.ts
// lefthook commit-msg hook: `node packages/tooling/src/git/check-commit-message.ts <msg-file>`.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';

import { checkCommitMessage } from './commit-message-rules.ts';

const EXTRA_SCOPES = ['repo', 'deps', 'docs', 'ci'];

type QualityGates = { readonly gatedPaths: readonly string[] };

function stagedFiles(): readonly string[] {
  const output = execFileSync('git', ['diff', '--cached', '--name-only', '-z'], {
    encoding: 'utf8',
  });
  return output.split('\0').filter((file) => file.length > 0);
}

function workspaceScopes(): readonly string[] {
  return ['apps', 'packages'].flatMap((root) => readdirSync(root));
}

function main(messageFile: string | undefined): number {
  if (messageFile === undefined) {
    console.error('usage: check-commit-message.ts <commit-msg-file>');
    return 1;
  }
  const gates = JSON.parse(readFileSync('quality-gates.json', 'utf8')) as QualityGates;
  const problems = checkCommitMessage({
    message: readFileSync(messageFile, 'utf8'),
    stagedFiles: stagedFiles(),
    gatedPatterns: gates.gatedPaths,
    allowedScopes: [...workspaceScopes(), ...EXTRA_SCOPES],
  });
  for (const problem of problems) {
    console.error(`commit-msg: ${problem}`);
  }
  return problems.length === 0 ? 0 : 1;
}

process.exitCode = main(process.argv[2]);
```

It enforces the Conventional Commits header (type, scope from the folders under `apps/` and `packages/` plus `repo`, `deps`, `docs`, `ci`, at most 72 characters, no trailing period) and requires a `Gate-Change:` trailer when a staged file matches `gatedPaths`. Git-generated headers (`Merge`, `Revert "`, `fixup!`, `squash!`, `amend!`) pass. Find every gate change later with:

```sh
git log --format='%h %s%n%(trailers:key=Gate-Change)' --grep='^Gate-Change:'
```

### 6. Claude Code hooks and permissions: `.claude/settings.json`

The Expo SDK 57 template ships `.claude/settings.json` with `{"enabledPlugins": {"expo@claude-plugins-official": true}}` (in the app folder `create-expo-app` creates). Move it to the repo root and merge; the result is:

```json
{
  "enabledPlugins": {
    "expo@claude-plugins-official": true
  },
  "permissions": {
    "deny": [
      "Read(~/.appstoreconnect/**)",
      "Read(**/*.p8)",
      "Read(**/AuthKey_*)",
      "Read(**/*.p12)",
      "Read(**/*.mobileprovision)",
      "Bash(git commit *--no-verify*)",
      "Bash(git commit -n *)",
      "Bash(git push *--no-verify*)"
    ],
    "ask": [
      "Edit(/eslint.config.mjs)",
      "Edit(/quality-gates.json)",
      "Edit(/lefthook.yml)",
      "Edit(/knip.json)",
      "Edit(/.prettierrc.json)",
      "Edit(/.npmrc)",
      "Edit(/jest.config.js)",
      "Edit(/jest.sim.config.js)",
      "Edit(/stryker.config.json)",
      "Edit(**/tsconfig*.json)",
      "Edit(/.claude/settings.json)"
    ]
  },
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "node",
            "args": ["${CLAUDE_PROJECT_DIR}/packages/tooling/src/hooks/after-edit.ts"],
            "timeout": 120
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "cd \"$CLAUDE_PROJECT_DIR\" && npm run -s check:fast 1>&2 || exit 2",
            "timeout": 600
          }
        ]
      }
    ]
  }
}
```

How each part behaves (from the Claude Code hooks and permissions docs, verified locally where marked):

- **PostToolUse `Edit|Write`** runs `after-edit.ts` in exec form (`command` + `args`), which is the documented way to reference `${CLAUDE_PROJECT_DIR}` in a path. The script formats the edited file with Prettier, runs `eslint --fix --max-warnings 0` on it, and on failure prints the problems to stderr and exits 2, so Claude sees them next to the tool result (verified: exit 2 with the naming-convention and `Math.random` errors of a bad file; ~5 s per edit). Files outside the repo and non-code files are skipped.
- **Stop** runs `npm run -s check:fast` with stdout sent to stderr; on failure it exits 2, which prevents Claude from stopping and feeds the errors back (verified: pass exits 0, a bad identifier exits 2 with the ESLint output). Claude Code allows 8 consecutive Stop-hook continuations (`CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`); if the cap ends the turn with checks still failing, report the failing gate to the owner instead of trying to get around it.
- **Hooks never change files silently beyond formatting.** After the PostToolUse hook reformats a file, re-read it before the next `Edit` of that file.
- **`permissions.deny`** stops Claude's file tools and recognised shell commands (`cat`, `head`…) from reading App Store Connect keys and signing files (FINAL A.10), and blocks the common hook-bypass commands (`*--no-verify*` matches the flag anywhere after `git commit` or `git push`; Bash rules accept `*` in any position). Deny rules do not cover arbitrary subprocesses, so the rule "never open or print the key" still applies to scripts.
- **`permissions.ask`** makes every edit to a gate file prompt the owner in real time (rule 7). In a non-interactive run the prompt cannot be answered and the edit is refused, which is the intended "stop and ask".
- The `enabledPlugins` entry is kept because FINAL D.42 says to merge. The plugin offers EAS and cloud skills that this project does not use (no EAS, no OTA updates); AGENTS.md must say so (see Open issues).

The PostToolUse script:

```ts
// packages/tooling/src/hooks/after-edit.ts
// Claude Code PostToolUse hook (Edit|Write): formats and lints the one file just edited.
// Exit 2 + stderr is the only way the agent sees the problems (code.claude.com/docs/en/hooks).
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const PRETTIER_EXTENSIONS = /\.(ts|tsx|js|mjs|cjs|json|md|ya?ml)$/u;
const ESLINT_EXTENSIONS = /\.(ts|tsx|js|mjs|cjs)$/u;

type HookInput = { readonly tool_input?: { readonly file_path?: string } };

function run(command: string, args: readonly string[]): { ok: boolean; output: string } {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  return { ok: result.status === 0, output: `${result.stdout}${result.stderr}` };
}

function editedFile(): string | null {
  const input = JSON.parse(readFileSync(0, 'utf8')) as HookInput;
  const filePath = input.tool_input?.file_path;
  if (filePath === undefined) {
    return null;
  }
  const relative = path.relative(process.cwd(), filePath);
  return relative.startsWith('..') ? null : relative;
}

function main(): number {
  process.chdir(process.env['CLAUDE_PROJECT_DIR'] ?? process.cwd());
  const file = editedFile();
  if (file === null || !PRETTIER_EXTENSIONS.test(file)) {
    return 0;
  }
  const format = run('npx', [
    'prettier',
    '--write',
    '--ignore-unknown',
    '--log-level',
    'warn',
    file,
  ]);
  const lint = ESLINT_EXTENSIONS.test(file)
    ? run('npx', ['eslint', '--fix', '--max-warnings', '0', '--no-warn-ignored', file])
    : { ok: true, output: '' };
  if (format.ok && lint.ok) {
    return 0;
  }
  console.error(`after-edit: fix these problems in ${file}\n${format.output}${lint.output}`);
  return 2;
}

process.exitCode = main();
```

### 7. The guardrail: `quality-gates.json` and `check-quality-gates.ts`

The most likely failure of an unsupervised agent is quietly relaxing a threshold to get green. The guardrail compares what the tools actually resolve with a checked-in expectation:

- `eslint --print-config <probe file>` for four probe paths (a game-kit file, a rules file, a component, a test; the files need not exist) against named rule sets;
- `tsc -p <project> --showConfig` for every tsconfig against the shared strict options plus per-project `types`/`lib` (a key may be a glob: `apps/*/tsconfig.json` covers every app, and a key that matches nothing is an error);
- `jest --showConfig` → `coverageThreshold` (a per-folder key may be absent only while that folder has no source files, because Jest fails on threshold keys that match nothing);
- the gate scripts in `package.json`, the `permissions` and `hooks` of `.claude/settings.json`, the `rules` of `knip.json`, the three hooks of `lefthook dump --format json`, and the `min-release-age=7`, `engine-strict=true` and `save-exact=true` lines of `.npmrc`.

Objects are compared as subsets (tools add defaults), arrays by position, values exactly. A mismatch prints the path and both values and exits 1. The `perf` and `a11y` sections hold docs/15's budgets; the tests read them from this file, so they are protected by the file's `Gate-Change:` rule rather than by a comparison.

```json
{
  "$comment": "Expected RESOLVED quality gates, checked by packages/tooling/src/quality/check-quality-gates.ts (npm run verify). Change only together with the gate itself and a Gate-Change: commit trailer.",
  "eslint": {
    "linterOptions": {
      "noInlineConfig": true,
      "reportUnusedDisableDirectives": 2,
      "reportUnusedInlineConfigs": 2
    },
    "ruleSets": {
      "logic": {
        "max-lines": [
          2,
          {
            "max": 250,
            "skipBlankLines": true,
            "skipComments": true
          }
        ],
        "max-lines-per-function": [
          2,
          {
            "max": 40,
            "skipBlankLines": true,
            "skipComments": true,
            "IIFEs": true
          }
        ],
        "complexity": [
          2,
          {
            "max": 10,
            "variant": "modified"
          }
        ],
        "sonarjs/cognitive-complexity": [2, 15],
        "max-depth": [2, 3],
        "max-params": [2, 3],
        "max-nested-callbacks": [2, 3],
        "max-classes-per-file": [2, 1],
        "@typescript-eslint/no-floating-promises": [
          2,
          {
            "ignoreVoid": false,
            "ignoreIIFE": false
          }
        ],
        "@typescript-eslint/strict-boolean-expressions": [
          2,
          {
            "allowString": false,
            "allowNumber": false,
            "allowNullableObject": true
          }
        ],
        "@typescript-eslint/no-explicit-any": [2],
        "@typescript-eslint/ban-ts-comment": [
          2,
          {
            "minimumDescriptionLength": 10
          }
        ],
        "import/no-default-export": [2],
        "no-restricted-properties": [
          2,
          {
            "object": "Math",
            "property": "random",
            "message": "Use the seeded RNG from @e07/game-kit."
          },
          {
            "object": "Date",
            "property": "now",
            "message": "Inject ClockPort (spec S15 set-date)."
          },
          {
            "object": "performance",
            "property": "now",
            "message": "Use the frame timestamp or ClockPort."
          },
          {
            "object": "I18nManager",
            "property": "isRTL",
            "message": "Read direction from DirectionContext."
          }
        ]
      },
      "component": {
        "max-lines-per-function": [
          2,
          {
            "max": 80,
            "skipBlankLines": true,
            "skipComments": true,
            "IIFEs": true
          }
        ],
        "react/jsx-max-depth": [
          2,
          {
            "max": 5
          }
        ],
        "react/no-multi-comp": [
          2,
          {
            "ignoreStateless": false
          }
        ],
        "react/jsx-no-literals": [
          2,
          {
            "noStrings": true,
            "ignoreProps": true,
            "noAttributeStrings": false
          }
        ],
        "react-native/no-inline-styles": [2],
        "react-native/no-color-literals": [2],
        "react-hooks/exhaustive-deps": [2]
      },
      "test": {
        "max-lines": [
          2,
          {
            "max": 400,
            "skipBlankLines": true,
            "skipComments": true
          }
        ],
        "max-nested-callbacks": [2, 4],
        "jest/expect-expect": [
          2,
          {
            "assertFunctionNames": ["expect", "fc.assert"]
          }
        ],
        "jest/no-identical-title": [2],
        "jest/no-focused-tests": [2],
        "jest/no-disabled-tests": [2],
        "jest/valid-title": [
          2,
          {
            "mustMatch": {
              "it": "^(can|[a-z]+s)\\b"
            }
          }
        ]
      }
    },
    "probes": {
      "packages/game-kit/src/gate-probe.ts": "logic",
      "apps/line-siege/src/rules/gate-probe.ts": "logic",
      "packages/shell/src/ui/gate-probe.tsx": "component",
      "packages/shell/src/ui/gate-probe.test.tsx": "test"
    }
  },
  "typescript": {
    "shared": {
      "strict": true,
      "noUncheckedIndexedAccess": true,
      "exactOptionalPropertyTypes": true,
      "noImplicitOverride": true,
      "noImplicitReturns": true,
      "noFallthroughCasesInSwitch": true,
      "noPropertyAccessFromIndexSignature": true,
      "erasableSyntaxOnly": true,
      "verbatimModuleSyntax": true,
      "isolatedModules": true,
      "useUnknownInCatchVariables": true,
      "allowUnreachableCode": false,
      "allowUnusedLabels": false,
      "forceConsistentCasingInFileNames": true,
      "customConditions": ["react-native-strict-api", "react-native"]
    },
    "projects": {
      "tsconfig.json": {
        "types": ["jest", "node"]
      },
      "packages/game-kit/tsconfig.json": {
        "types": ["jest"],
        "lib": ["esnext"]
      },
      "packages/shell/tsconfig.json": {
        "types": ["jest"]
      },
      "packages/tooling/tsconfig.json": {
        "types": ["node", "jest"]
      },
      "apps/*/tsconfig.json": {
        "types": ["jest"]
      }
    }
  },
  "jest": {
    "coverageThreshold": {
      "global": {
        "statements": 90,
        "lines": 90,
        "functions": 90,
        "branches": 85
      },
      "./packages/game-kit/src/": {
        "statements": 95,
        "lines": 95,
        "functions": 95,
        "branches": 90
      },
      "./packages/shell/src/services/save/": {
        "statements": 95,
        "lines": 95,
        "functions": 95,
        "branches": 90
      },
      "./apps/*/src/rules/**/*.ts": {
        "statements": 95,
        "lines": 95,
        "functions": 95,
        "branches": 90
      }
    }
  },
  "npmScripts": {
    "verify": "npm run -s format:check && npm run -s lint && npm run -s typecheck && npm run -s i18n:verify && npm run -s knip && node packages/tooling/src/quality/check-quality-gates.ts && npm run -s test:coverage && npm run -s test:sim && npm run -s audit:network && npm run -s audit:licenses && node packages/tooling/src/deps/check-deps.ts",
    "check:fast": "prettier --check . --log-level warn && eslint . --max-warnings 0 --cache --cache-strategy content --cache-location node_modules/.cache/eslint/ && npm run -s typecheck && jest --ci --onlyChanged --passWithNoTests",
    "format:check": "prettier --check . --log-level warn",
    "lint": "eslint . --max-warnings 0",
    "typecheck": "tsc --noEmit -p tsconfig.json && for project in packages/* apps/*; do tsc --noEmit -p \"$project\" || exit 1; done",
    "test": "jest --ci",
    "test:coverage": "jest --ci --coverage --randomize",
    "test:sim": "jest --ci --config jest.sim.config.js",
    "test:golden": "jest --ci --selectProjects golden",
    "knip": "APP_VARIANT=test ADS_MODE=off knip"
  },
  "claudeSettings": {
    "permissions": {
      "deny": [
        "Read(~/.appstoreconnect/**)",
        "Read(**/*.p8)",
        "Read(**/AuthKey_*)",
        "Read(**/*.p12)",
        "Read(**/*.mobileprovision)",
        "Bash(git commit *--no-verify*)",
        "Bash(git commit -n *)",
        "Bash(git push *--no-verify*)"
      ],
      "ask": [
        "Edit(/eslint.config.mjs)",
        "Edit(/quality-gates.json)",
        "Edit(/lefthook.yml)",
        "Edit(/knip.json)",
        "Edit(/.prettierrc.json)",
        "Edit(/.npmrc)",
        "Edit(/jest.config.js)",
        "Edit(/jest.sim.config.js)",
        "Edit(/stryker.config.json)",
        "Edit(**/tsconfig*.json)",
        "Edit(/.claude/settings.json)"
      ]
    },
    "hooks": {
      "PostToolUse": [
        {
          "matcher": "Edit|Write",
          "hooks": [
            {
              "type": "command",
              "command": "node",
              "args": ["${CLAUDE_PROJECT_DIR}/packages/tooling/src/hooks/after-edit.ts"],
              "timeout": 120
            }
          ]
        }
      ],
      "Stop": [
        {
          "hooks": [
            {
              "type": "command",
              "command": "cd \"$CLAUDE_PROJECT_DIR\" && npm run -s check:fast 1>&2 || exit 2",
              "timeout": 600
            }
          ]
        }
      ]
    }
  },
  "knip": {
    "workspaces": {
      "packages/game-kit": { "includeEntryExports": true },
      "packages/shell": { "includeEntryExports": true },
      "packages/tooling": { "includeEntryExports": true }
    },
    "rules": {
      "files": "error",
      "dependencies": "error",
      "devDependencies": "error",
      "optionalPeerDependencies": "error",
      "unlisted": "error",
      "binaries": "error",
      "unresolved": "error",
      "exports": "error",
      "nsExports": "error",
      "types": "error",
      "nsTypes": "error",
      "enumMembers": "error",
      "namespaceMembers": "error",
      "duplicates": "error",
      "catalog": "error",
      "catalogReferences": "error",
      "cycles": "error"
    }
  },
  "lefthook": {
    "pre-commit": {
      "parallel": true,
      "jobs": [
        {
          "name": "no-secrets",
          "run": "echo \"Refusing to commit a secret or signing file:\" {staged_files} >&2; exit 1",
          "glob": [
            "*.p8",
            "*.p12",
            "*.mobileprovision",
            "*.keystore",
            "*.jks",
            "AuthKey_*",
            "**/AuthKey_*",
            "ApiKey_*",
            "**/ApiKey_*",
            ".env*",
            "**/.env*"
          ]
        },
        {
          "name": "format",
          "run": "npx prettier --check {staged_files}",
          "glob": ["*.{ts,tsx,js,mjs,cjs,json,md,yml,yaml}"]
        },
        {
          "name": "lint",
          "run": "npx eslint --max-warnings 0 --no-warn-ignored {staged_files}",
          "glob": ["*.{ts,tsx,js,mjs,cjs}"]
        },
        {
          "name": "typecheck",
          "run": "npm run -s typecheck",
          "glob": ["*.{ts,tsx,json}"]
        },
        {
          "name": "test-related",
          "run": "npx jest --ci --bail --findRelatedTests --passWithNoTests {staged_files}",
          "glob": ["*.{ts,tsx,json}"]
        }
      ]
    },
    "commit-msg": {
      "jobs": [
        {
          "name": "commit-message",
          "run": "node packages/tooling/src/git/check-commit-message.ts {1}"
        }
      ]
    },
    "pre-push": {
      "jobs": [
        {
          "name": "verify",
          "run": "npm run verify"
        }
      ]
    }
  },
  "npmrcLines": ["min-release-age=7", "engine-strict=true", "save-exact=true"],
  "perf": {
    "coldStartHomeMsMax": 1000,
    "coldStartSimRegressionFactor": 1.2,
    "hitchMsPerSecondMax": 10,
    "frameP95MsMax": 17,
    "saveWriteP95MsMax": 5,
    "drawCallsPerFrameMax": 1000,
    "bundleJsBytesMax": 6000000,
    "bundleGrowthMaxRatio": 1.1,
    "memoryFootprintMbMax": 150,
    "levelGridTilesMax": 150,
    "skiaCanvasesPerScreenMax": 8
  },
  "a11y": {
    "minTouchPt": 44,
    "maxFontScale": 2,
    "textContrastMin": 4.5,
    "nonTextContrastMin": 3,
    "minCvdDistanceOk": 0.07
  },
  "gatedPaths": [
    "quality-gates.json",
    "eslint.config.mjs",
    "tsconfig.base.json",
    "tsconfig.json",
    "**/tsconfig.json",
    "jest.config.js",
    "jest.sim.config.js",
    "stryker.config.json",
    "knip.json",
    "lefthook.yml",
    ".prettierrc.json",
    ".prettierignore",
    ".npmrc",
    ".claude/settings.json",
    "packages/tooling/network-audit/**",
    "packages/tooling/license-exceptions.json",
    "packages/tooling/scripts/install-maestro.sh",
    "babel.config.js",
    "jest.setup.ts",
    "tsconfig.stryker.json",
    "test/goldens/boards/skia-golden.ts",
    "**/__snapshots__/*.golden.test.ts.snap",
    "**/*.golden.test.ts.snap.ios",
    "**/__image_snapshots__/**",
    "apps/*/e2e/baselines/**",
    "**/fixtures/save-v*.json"
  ]
}
```

```ts
// packages/tooling/src/quality/gate-diff.ts

type Json = null | boolean | number | string | readonly Json[] | { readonly [key: string]: Json };

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function diffArray(expected: readonly Json[], actual: unknown, where: string): readonly string[] {
  if (!Array.isArray(actual) || actual.length !== expected.length) {
    return [`${where}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`];
  }
  return expected.flatMap((item, index) =>
    diffSubset(item, actual[index], `${where}[${String(index)}]`),
  );
}

/**
 * Lists every place where `actual` differs from `expected`. Objects are compared key by key
 * (keys only in `actual`, such as defaults filled in by a tool, are allowed); arrays must have
 * the same length and matching items; primitives must be equal.
 */
export function diffSubset(expected: Json, actual: unknown, where: string): readonly string[] {
  if (Array.isArray(expected)) {
    return diffArray(expected, actual, where);
  }
  if (isRecord(expected)) {
    if (!isRecord(actual)) {
      return [`${where}: expected an object, got ${JSON.stringify(actual)}`];
    }
    return Object.entries(expected).flatMap(([key, value]) =>
      diffSubset(value, actual[key], `${where}.${key}`),
    );
  }
  return expected === actual
    ? []
    : [`${where}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`];
}
```

```ts
// packages/tooling/src/quality/gate-diff.test.ts
import { diffSubset } from './gate-diff.ts';

describe('diffSubset', () => {
  it('ignores keys that only exist in the actual value', () => {
    expect(diffSubset({ max: 250 }, { max: 250, skipComments: true }, 'rule')).toStrictEqual([]);
  });

  it('reports a weakened limit with its path', () => {
    const expected = { rules: { 'max-params': [2, 3] } };
    const actual = { rules: { 'max-params': [2, 5] } };
    expect(diffSubset(expected, actual, 'eslint')).toStrictEqual([
      'eslint.rules.max-params[1]: expected 3, got 5',
    ]);
  });

  it('reports a rule whose options were removed', () => {
    expect(diffSubset([2, { max: 40 }], [2], 'rule')).toHaveLength(1);
  });

  it('reports a missing object', () => {
    expect(diffSubset({ hooks: { Stop: [] } }, undefined, 'claude')).toHaveLength(1);
  });
});
```

```ts
// packages/tooling/src/quality/check-quality-gates.ts
// Guardrail (FINAL D.42): the RESOLVED configs must equal quality-gates.json.
// Run by `npm run verify`; a mismatch means a gate was weakened or quality-gates.json is stale.
import { execFileSync } from 'node:child_process';
import { globSync, readFileSync } from 'node:fs';

import { diffSubset } from './gate-diff.ts';

type Json = null | boolean | number | string | readonly Json[] | { readonly [key: string]: Json };
type JsonObject = Readonly<Record<string, Json>>;
type Gates = {
  readonly eslint: {
    readonly linterOptions: Json;
    /** Named sets of resolved rule values, e.g. "logic", "component", "test". */
    readonly ruleSets: Readonly<Record<string, JsonObject>>;
    /** Probe file path (it need not exist) -> name of the rule set it must resolve to. */
    readonly probes: Readonly<Record<string, string>>;
  };
  readonly typescript: {
    readonly shared: JsonObject;
    /** tsconfig path or glob -> options it must resolve to (on top of `shared`). */
    readonly projects: Readonly<Record<string, JsonObject>>;
  };
  readonly jest: { readonly coverageThreshold: JsonObject };
  readonly npmScripts: Json;
  readonly claudeSettings: Json;
  readonly knip: Json;
  readonly lefthook: Json;
  readonly npmrcLines: readonly string[];
};

const readJson = (file: string): unknown => JSON.parse(readFileSync(file, 'utf8'));
const npx = (args: readonly string[]): unknown =>
  JSON.parse(execFileSync('npx', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));

function checkEslint(gates: Gates): readonly string[] {
  return Object.entries(gates.eslint.probes).flatMap(([file, ruleSet]) => {
    const resolved = npx(['eslint', '--print-config', file]) as Record<string, unknown>;
    const rules = gates.eslint.ruleSets[ruleSet] ?? null;
    return [
      ...diffSubset(
        gates.eslint.linterOptions,
        resolved['linterOptions'],
        `eslint(${file}).linterOptions`,
      ),
      ...diffSubset(rules, resolved['rules'], `eslint(${file}).rules`),
    ];
  });
}

function checkTypescript(gates: Gates): readonly string[] {
  // A key may be a glob ("apps/*/tsconfig.json"), so every new app is checked without an edit here.
  return Object.entries(gates.typescript.projects).flatMap(([pattern, options]) => {
    const projects = globSync(pattern);
    if (projects.length === 0) {
      return [`tsc(${pattern}): no tsconfig matches this entry`];
    }
    return projects.flatMap((project) => {
      const resolved = npx(['tsc', '-p', project, '--showConfig']) as Record<string, unknown>;
      const expected = { ...gates.typescript.shared, ...options };
      return diffSubset(expected, resolved['compilerOptions'], `tsc(${project})`);
    });
  });
}

function hasSourceFiles(key: string): boolean {
  const pattern = key.endsWith('/') ? `${key}**/*.{ts,tsx}` : key;
  return globSync(pattern).some((file) => !file.includes('.test.'));
}

function checkJest(gates: Gates): readonly string[] {
  const resolved = npx(['jest', '--showConfig']) as {
    globalConfig: { coverageThreshold: unknown };
  };
  const actual = resolved.globalConfig.coverageThreshold as Readonly<Record<string, unknown>>;
  return Object.entries(gates.jest.coverageThreshold).flatMap(([key, expected]) => {
    if (actual[key] === undefined && key !== 'global' && !hasSourceFiles(key)) {
      return [];
    }
    return diffSubset(expected, actual[key], `jest.coverageThreshold[${key}]`);
  });
}

function checkFiles(gates: Gates): readonly string[] {
  const packageJson = readJson('package.json') as { scripts?: unknown };
  const npmrc = readFileSync('.npmrc', 'utf8').split('\n');
  const lefthook = npx(['lefthook', 'dump', '--format', 'json']);
  return [
    ...diffSubset(gates.npmScripts, packageJson.scripts, 'package.json scripts'),
    ...diffSubset(gates.claudeSettings, readJson('.claude/settings.json'), '.claude/settings.json'),
    ...diffSubset(gates.knip, readJson('knip.json'), 'knip.json'),
    ...diffSubset(gates.lefthook, lefthook, 'lefthook.yml'),
    ...gates.npmrcLines
      .filter((line) => !npmrc.includes(line))
      .map((line) => `.npmrc: missing line "${line}"`),
  ];
}

function main(): number {
  const gates = readJson('quality-gates.json') as Gates;
  const problems = [
    ...checkEslint(gates),
    ...checkTypescript(gates),
    ...checkJest(gates),
    ...checkFiles(gates),
  ];
  for (const problem of problems) {
    console.error(`quality-gates: ${problem}`);
  }
  if (problems.length > 0) {
    console.error(
      'A gate differs from quality-gates.json. Restore the gate; never edit the JSON to match.',
    );
    return 1;
  }
  console.log('quality-gates: all resolved configs match quality-gates.json');
  return 0;
}

process.exitCode = main();
```

The ESLint probe `apps/line-siege/src/rules/gate-probe.ts` names the pilot; later apps need no entries, because the ESLint globs and the `apps/*/tsconfig.json` key cover them (verified: a second app with `"strict": false` was reported). When a new package is added under `packages/`, add its tsconfig under `typescript.projects` in the same commit (`Gate-Change:`).

### 8. `knip.json`

```json
{
  "$schema": "https://unpkg.com/knip@6/schema.json",
  "ignoreExportsUsedInFile": true,
  "workspaces": {
    ".": {
      "entry": ["__mocks__/**/*.ts", "test/**/*.test.ts"],
      "project": ["*.ts", "__mocks__/**/*.ts", "test/**/*.ts"],
      "ignoreDependencies": [
        "react-native-gesture-handler",
        "react-native-reanimated",
        "react-native-worklets"
      ]
    },
    "apps/*": {
      "entry": ["src/index.ts", "**/*.test.{ts,tsx}"],
      "project": ["*.ts", "src/**/*.{ts,tsx}"]
    },
    "packages/game-kit": {
      "includeEntryExports": true,
      "entry": ["**/*.test.{ts,tsx}"],
      "project": ["src/**/*.ts"]
    },
    "packages/shell": {
      "includeEntryExports": true,
      "entry": ["plugins/*.ts", "**/*.test.{ts,tsx}"],
      "project": ["src/**/*.{ts,tsx}", "plugins/**/*.ts"]
    },
    "packages/tooling": {
      "includeEntryExports": true,
      "entry": ["src/**/*.ts", "**/*.test.{ts,tsx}"],
      "project": ["src/**/*.ts"]
    }
  },
  "rules": {
    "files": "error",
    "dependencies": "error",
    "devDependencies": "error",
    "optionalPeerDependencies": "error",
    "unlisted": "error",
    "binaries": "error",
    "unresolved": "error",
    "exports": "error",
    "nsExports": "error",
    "types": "error",
    "nsTypes": "error",
    "enumMembers": "error",
    "namespaceMembers": "error",
    "duplicates": "error",
    "catalog": "error",
    "catalogReferences": "error",
    "cycles": "error"
  }
}
```

- **Why `includeEntryExports` on the three packages.** knip turns every `package.json` `exports` target into entry files, so `"./*": "./src/*"` makes each file of game-kit and the Shell an entry (and tooling lists all of `src/**` as entries for its CLIs): without the setting, an unused Shell or game-kit file is never reported (verified: knip passed with two dead files present). With it, an unused file shows up as its unused exports. `ignoreExportsUsedInFile` keeps knip quiet about exports that their own file uses (a component's `<Component>Props` type, an `as const` table beside its union type). The root workspace keeps the default, because Jest consumes the root `__mocks__` exports invisibly. A config plugin that Expo loads by path string (docs/04 rule 21) marks its default export `/** @public … */`, or knip reports it (verified).
- Every issue type that knip 6.38 knows is listed as `error` (FINAL D.37; the list is `ISSUE_TYPES` in knip's `dist/constants.js`). This matters for `cycles`, whose default is `warn`, which does not fail the run. knip 6 has no `classMembers` type; listing it prints a warning.
- The Expo plugin loads `app.config.ts`, which is why the `knip` script sets `APP_VARIANT` and `ADS_MODE`. It also expects `expo-updates` unless `updates.enabled` is `false`, and `expo-system-ui` when `userInterfaceStyle` is `automatic`: `withShell` must set `updates: { enabled: false }` and every app must depend on `expo-system-ui` (both verified).
- Root `ignoreDependencies` lists the native libraries that the root `jest.setup.ts` imports but that are installed in the apps with `npx expo install`; listing them again at the root would split their versions.
- Tool dependencies referenced only from configs must be root devDependencies, or knip reports them: `@stryker-mutator/core` (for the `stryker` binary) and `babel-jest` 29.7.0 (referenced by `jest.sim.config.js`); verified: knip fails without them and passes with them.
- "Configuration hints" (patterns that match nothing yet) do not fail the run.

### 9. Supply chain

#### 9.1 `.npmrc` and the release-age cooldown

The complete root `.npmrc` (keys `min-release-age=7`, `engine-strict=true`, `save-exact=true`, and the dated bootstrap block of `min-release-age-exclude[]` entries that expires on 2026-10-03) is owned by [docs/01 section 3.4](01-stack-and-versions.md). This doc adds only the gates around it: the guardrail checks that the three policy lines are present, `check-deps.ts` fails on an undated or expired exclude block, and `.npmrc` is a gated path (`Gate-Change:`).

Behaviour verified with npm 11.17.0 on 2026-09-26 (independently of docs/01, same results):

- `min-release-age=7` makes `npm install prettier@3.9.9` fail with `ETARGET … No matching version found for prettier@3.9.9 with a date before …` while that version is younger than 7 days; a range (`^3.9.0`) resolves to the newest version older than 7 days (3.9.8).
- `min-release-age-exclude[]=<name>` lets that one package install at any age; comment lines above it are allowed (npm reads no inline comments, so the reason goes on its own line).
- `npm ci`, and `npm install` with an existing lockfile, install the locked versions without re-checking age. The cooldown acts at the moment a version enters `package-lock.json`, when a dependency is added or upgraded.
- `save-exact=true` makes npm write an exact version even for a range request (`npm install x@~3.0.0` saved `"3.0.1"`).
- The cooldown covers npm only. CocoaPods versions follow the npm packages' podspecs and are checked by the Podfile.lock vendor-pod allowlist in the network audit (FINAL D.44).

#### 9.2 Install scripts

npm 11.17 lists packages whose install scripts are not yet in `package.json` → `allowScripts` and says a future release will block them. Review each script, then approve it (pinned to the installed version by default):

```sh
npm approve-scripts --allow-scripts-pending   # read-only list; exits 0 either way
npm approve-scripts lefthook unrs-resolver @shopify/react-native-skia
```

Expected entries: `lefthook` (postinstall installs its binary), `unrs-resolver` (native resolver used by the ESLint import resolver), `fsevents` (macOS file watching), `@shopify/react-native-skia` (postinstall copies about 205 MB of iOS xcframeworks into `libs/`; an empty `libs/ios` breaks the iOS build). Re-approve after a version bump. `check-deps.ts` fails unless the pending list prints `No packages with unreviewed install scripts.` (the command exits 0 either way, verified).

#### 9.3 Licence audit

`npm run audit:licenses` reads the source maps of the release bundles that `audit:network` exported (`dist-audit/<game-id>/_expo/static/js/ios/*.map`), finds the npm package that owns every bundled source, reads its `license`, and checks the SPDX expression (`OR` needs one allowed side, `AND` all). Only shipped code is audited: build tools such as Expo CLI's `lightningcss` (MPL-2.0) are in the lockfile but not in the app, and must not fail the audit. Fonts and sounds are not npm packages; their licences (Vazirmatn OFL-1.1, CC0 sounds) are recorded for the S11d licences screen by docs/09 section 9 and docs/10.

```ts
// packages/tooling/src/audit/license-policy.ts

/** Licences a shipped dependency may use without an exception (FINAL D.43). */
export const ALLOWED_LICENSES = [
  'MIT',
  'ISC',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  '0BSD',
  'OFL-1.1',
  'CC0-1.0',
] as const;

export type LicenseException = { readonly license: string; readonly reason: string };

/**
 * True when an SPDX expression is acceptable: an OR needs one allowed side, an AND needs both.
 * Parentheses are not nested in any npm package we ship, so one level is enough.
 */
export function isAllowedLicense(expression: string): boolean {
  const cleaned = expression.replace(/[()]/gu, '').trim();
  if (cleaned.includes(' OR ')) {
    return cleaned.split(' OR ').some((part) => isAllowedLicense(part));
  }
  if (cleaned.includes(' AND ')) {
    return cleaned.split(' AND ').every((part) => isAllowedLicense(part));
  }
  return ALLOWED_LICENSES.some((allowed) => allowed === cleaned);
}

/** Maps a bundled source path to the package root that owns it, or null for our own code. */
export function packageRootOf(sourcePath: string): string | null {
  const match = /^(?<root>.*node_modules\/(?:@[^/]+\/)?[^/]+)\//u.exec(sourcePath);
  return match?.groups?.['root'] ?? null;
}

/** Returns one problem per package whose licence is neither allowed nor excepted. */
export function licenseProblems(
  licenses: ReadonlyMap<string, string | null>,
  exceptions: Readonly<Record<string, LicenseException>>,
): readonly string[] {
  return [...licenses.entries()].flatMap(([name, license]) => {
    if (license !== null && isAllowedLicense(license)) {
      return [];
    }
    if (exceptions[name]?.license === license) {
      return [];
    }
    return [`${name}: licence "${String(license)}" is not allowed and has no exception entry`];
  });
}
```

```ts
// packages/tooling/src/audit/license-policy.test.ts
import { isAllowedLicense, licenseProblems, packageRootOf } from './license-policy.ts';

describe('isAllowedLicense', () => {
  it('accepts an OR expression with one allowed side', () => {
    expect(isAllowedLicense('(BSD-3-Clause OR GPL-2.0)')).toBe(true);
  });

  it('rejects a copyleft licence', () => {
    expect(isAllowedLicense('MPL-2.0')).toBe(false);
  });
});

describe('packageRootOf', () => {
  it('finds a scoped package root', () => {
    expect(packageRootOf('../../node_modules/@formatjs/intl/lib/x.js')).toBe(
      '../../node_modules/@formatjs/intl',
    );
  });

  it('returns null for our own sources', () => {
    expect(packageRootOf('packages/shell/src/ui/app-text.tsx')).toBeNull();
  });
});

describe('licenseProblems', () => {
  it('accepts an excepted licence only when the exception names that licence', () => {
    const licenses = new Map([['caniuse-lite', 'CC-BY-4.0']]);
    const exceptions = { 'caniuse-lite': { license: 'CC-BY-4.0', reason: 'data only' } };
    expect(licenseProblems(licenses, exceptions)).toStrictEqual([]);
  });
});
```

```ts
// packages/tooling/src/audit/audit-licenses.ts
// `npm run audit:licenses`: every npm package that ends up in a release JS bundle must carry an
// allowed licence. Input: the source maps written by `npm run audit:network` (expo export).
import { existsSync, globSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { licenseProblems, packageRootOf, type LicenseException } from './license-policy.ts';

const EXCEPTIONS_FILE = 'packages/tooling/license-exceptions.json';
const DEFAULT_MAPS = 'dist-audit/*/_expo/static/js/ios/*.map';

type SourceMap = { readonly sources: readonly string[] };
type PackageJson = { readonly name?: string; readonly license?: unknown };

function readPackage(root: string): PackageJson {
  return JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as PackageJson;
}

function shippedLicenses(mapFiles: readonly string[]): ReadonlyMap<string, string | null> {
  const licenses = new Map<string, string | null>();
  for (const mapFile of mapFiles) {
    const map = JSON.parse(readFileSync(mapFile, 'utf8')) as SourceMap;
    const roots = new Set(map.sources.map((source) => packageRootOf(source)));
    for (const root of roots) {
      // Expo writes sources relative to the server root (the repo root), with a leading '/'.
      const absolute = root === null ? null : path.join(process.cwd(), root);
      if (absolute === null || !existsSync(path.join(absolute, 'package.json'))) {
        continue;
      }
      const pkg = readPackage(absolute);
      licenses.set(pkg.name ?? absolute, typeof pkg.license === 'string' ? pkg.license : null);
    }
  }
  return licenses;
}

function main(argv: readonly string[]): number {
  const mapFiles = argv.length > 0 ? argv : globSync(DEFAULT_MAPS);
  if (mapFiles.length === 0) {
    console.error(
      `audit:licenses: no source maps at ${DEFAULT_MAPS}; run npm run audit:network first`,
    );
    return 1;
  }
  const exceptions = existsSync(EXCEPTIONS_FILE)
    ? (JSON.parse(readFileSync(EXCEPTIONS_FILE, 'utf8')) as Record<string, LicenseException>)
    : {};
  const licenses = shippedLicenses(mapFiles);
  const problems = licenseProblems(licenses, exceptions);
  problems.forEach((problem) => {
    console.error(`audit:licenses: ${problem}`);
  });
  console.log(`audit:licenses: ${String(licenses.size)} shipped packages checked`);
  return problems.length === 0 ? 0 : 1;
}

process.exitCode = main(process.argv.slice(2));
```

`packages/tooling/license-exceptions.json` maps a package name to `{ "license": "<exact SPDX>", "reason": "<why it is acceptable>" }`; an exception applies only while the package keeps that exact licence.

#### 9.4 Freshness

- `check-deps.ts` runs `npx expo install --check` and `npx expo-doctor` in every app on every `verify`.
- Monthly, and before each release: follow docs/01's dependency pass (`npx expo install --check` per app, `npm outdated`, age and changelog check, all apps together), then `npm run verify` plus the E2E and screenshot runs.
- Expo SDK upgrades follow FINAL A.1 (all apps in lockstep, SDK 58 only once stable and green everywhere).

### 10. Optional CI: GitHub Actions

Local `verify` is the gate (FINAL D.45). If the owner wants CI, this workflow runs the static gates on every push and pull request, and the iOS E2E job nightly or on demand on `macos-26` (arm64, Xcode 26.6, iOS 26.5 simulators, `JAVA_HOME_17_arm64`). Screenshot baselines must name a simulator that exists on that image (for example iPhone 17 Pro Max and iPad Pro 13-inch (M5) on iOS 26.5).

```yaml
# .github/workflows/verify.yml: OPTIONAL CI (FINAL D.45). Local `npm run verify` stays the gate.
name: verify

on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:
  schedule:
    - cron: '0 3 * * *'

permissions:
  contents: read

concurrency:
  group: verify-${{ github.ref }}
  cancel-in-progress: true

env:
  LEFTHOOK: '0'
  EXPO_NO_TELEMETRY: '1'

jobs:
  static:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npm run verify
      - uses: actions/upload-artifact@v7
        if: always()
        with:
          name: reports
          path: reports/
          if-no-files-found: ignore

  ios-e2e:
    if: github.event_name == 'schedule' || github.event_name == 'workflow_dispatch'
    needs: static
    runs-on: macos-26
    timeout-minutes: 90
    env:
      MAESTRO_CLI_NO_ANALYTICS: 'true'
      MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED: 'true'
      MAESTRO_DISABLE_UPDATE_CHECK: 'true'
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: echo "JAVA_HOME=$JAVA_HOME_17_arm64" >> "$GITHUB_ENV"
      - run: npm ci
      - run: bash packages/tooling/scripts/install-maestro.sh
      - run: npm run build:ios:sim -- --app line-siege
      - run: npm run e2e:ios -- --app line-siege
      - uses: actions/upload-artifact@v7
        if: always()
        with:
          name: e2e
          path: reports/e2e/
          if-no-files-found: ignore
```

- `LEFTHOOK: '0'` turns git-hook execution off on the runner (`npm ci` still runs `prepare`, which installs the hooks harmlessly; verified with lefthook 2.1.14).
- Linux minutes cost about a tenth of macOS minutes ($0.006 vs $0.062 per minute on standard runners), so only the simulator job runs on macOS.
- `packages/tooling/scripts/install-maestro.sh` is the checksum-verified Maestro installer from docs/07 section 3.11.
- `expo export` on Linux (inside `audit:network`) is expected to work but was not run on Linux.

### 11. When a gate fails

1. **Read the whole output.** Every custom rule message names the spec item or decision and the fix (for example `Spec N11: use start/end (marginStart, paddingEnd, start, end), never left/right.`).
2. **Fix the code, the test or the translation**, not the gate:

| Failure | Fix |
|---|---|
| Prettier | `npm run format` (the PostToolUse hook normally prevents this) |
| ESLint limit (`max-lines`, `complexity`…) | split by responsibility (docs/04 section 5) |
| ESLint restricted API | use the Shell alternative named in the message (ClockPort, seeded RNG, AppText, Shell dialog, the port) |
| `tsc` | fix the types; never `as unknown as`, `any` or `!` to silence it |
| Failing test | fix the code; change the test only if the spec changed, with a `Spec-Change:` trailer (FINAL D.41) |
| Coverage below threshold | add tests for the uncovered behaviour (not assertion-free tests: Stryker and `jest/expect-expect` catch those) |
| Golden or screenshot diff | find the cause; update the golden (`jest -u`, new baseline) only if the change is intended, then `Gate-Change:` |
| knip | delete the dead code or dependency; add an `ignore` entry only for a tool-only reference, with a `Gate-Change:` trailer |
| `audit:network`, `audit:licenses` | remove the dependency or network path; an exception needs the owner |
| `check-deps` | `npx expo install --fix` in the app; review and approve install scripts |
| Guardrail | restore the gate to its expected value; never edit `quality-gates.json` to match |
| `commit-msg` | rewrite the message; add the trailer the check asks for |

3. **Rerun** the specific script, then `npm run check:fast`.
4. **Flaky test**: reproduce with the printed seed (`jest --seed=<n>`, fast-check's `seed`/`path`); make it deterministic (fake clock, seeded RNG, fake timers). Retries (`jest.retryTimes`, Maestro `retry`) are not a fix.
5. **Never**: add `eslint-disable`, `@ts-ignore`, `it.skip`, `.only`, `--no-verify`, `--passWithNoTests` in a new place, a lower threshold, a broader exemption glob, or a `min-release-age-exclude` without a reason and removal date.
6. **If the gate itself looks wrong** (a false positive, a rule that contradicts the spec or FINAL-DECISIONS, a tool bug): stop. Write the owner a short note with the gate, the file and line, the exact message, why it looks wrong, and the smallest proposed change. Continue with other work if possible. Change the gate only after the owner agrees, in one commit that also updates `quality-gates.json`, with a `Gate-Change:` trailer (the `ask` permission prompt will appear).

## Checklist

- [ ] `npm run check:fast` passes; before a push `npm run verify` passes (the hook runs it).
- [ ] No hook was bypassed; no gate file changed without owner agreement and a `Gate-Change:` trailer.
- [ ] `node packages/tooling/src/quality/check-quality-gates.ts` prints `all resolved configs match quality-gates.json`.
- [ ] A new package under `packages/`: its `tsconfig.json` is in `quality-gates.json` → `typescript.projects` and knip has a workspace entry (new apps are covered by the `apps/*` globs). Its folder is then a valid commit scope automatically.
- [ ] A new dependency: exact version, at least 7 days old (or inside a dated exclude block, docs/01), all apps in lockstep, install scripts reviewed and approved, licence allowed, `knip` clean.
- [ ] `.claude/settings.json` still contains the template's keys plus the `permissions` and `hooks` above, and the session was started at the repo root.
- [ ] No secrets, keys or `.env` files staged; `git status` clean after the commit.

## Sources

- FINAL-DECISIONS D.34-D.45 and F (binding).
- Claude Code hooks (events, exit code 2, exec form, Stop cap): https://code.claude.com/docs/en/hooks
- Claude Code settings: https://code.claude.com/docs/en/settings
- Claude Code permissions (deny/ask/allow order, Read/Edit path rules, settings location): https://code.claude.com/docs/en/permissions
- Claude Code best practices (verification, hooks as deterministic gates): https://code.claude.com/docs/en/best-practices
- lefthook configuration: https://lefthook.dev/ and https://github.com/evilmartians/lefthook/blob/master/docs/configuration/glob.md
- Conventional Commits 1.0.0: https://www.conventionalcommits.org/en/v1.0.0/
- git interpret-trailers and pretty formats (`%(trailers)`): https://git-scm.com/docs/git-interpret-trailers and https://git-scm.com/docs/pretty-formats
- ESLint `--print-config`: https://eslint.org/docs/latest/use/command-line-interface#--print-config
- TypeScript `--showConfig`: https://www.typescriptlang.org/tsconfig/#showConfig
- Jest CLI (`--showConfig`, `--onlyChanged`, `--findRelatedTests`, `--randomize`, `--ci`): https://jestjs.io/docs/cli
- Jest `coverageThreshold`: https://jestjs.io/docs/configuration#coveragethreshold-object
- knip configuration and Expo plugin: https://knip.dev/reference/configuration and https://knip.dev/reference/plugins/expo
- npm config (`min-release-age`, `min-release-age-exclude`, `save-exact`, `engine-strict`): https://docs.npmjs.com/cli/v11/using-npm/config
- npm approve-scripts: https://docs.npmjs.com/cli/v11/commands/npm-approve-scripts
- npm ci: https://docs.npmjs.com/cli/v11/commands/npm-ci
- Expo CLI `install --check` and expo-doctor: https://docs.expo.dev/more/expo-cli/#install
- SPDX licence expressions: https://spdx.github.io/spdx-spec/v2.3/SPDX-license-expressions/
- GitHub Actions runner images (macos-26): https://github.com/actions/runner-images/blob/main/images/macos/macos-26-arm64-Readme.md
- GitHub Actions pricing: https://docs.github.com/en/billing/reference/actions-runner-pricing
- actionlint: https://github.com/rhysd/actionlint

## Verified

On 2026-09-26, in a throwaway monorepo (`scratchpad/rn/writer-03-04-16/repo`, git repo, Node 26.4.0, npm 11.17.0, lefthook 2.1.14, ESLint 9.39.5, TypeScript 6.0.3, Jest 29.7 + jest-expo 57.0.5, knip 6.38.0, Prettier 3.9.9):

- `lefthook install` synced `pre-commit`, `commit-msg`, `pre-push`; `lefthook validate` passed. Real commits: a commit touching gate files was rejected until a `Gate-Change:` trailer was added; `Updated stuff.` and `feat(ui): …` were rejected; `feat(line-siege): …` passed; a staged `AuthKey_ABC.p8` was refused by `no-secrets`. Full `pre-commit` on all files: 3.6-4.2 s.
- The Stop-hook command exited 0 on a clean tree (6.6 s) and 2 with the ESLint output after a bad identifier was added; `after-edit.ts` exited 0 on a clean file and 2 on a bad one (~5 s per run).
- The guardrail passed on the sample repo (29 s wall time) and reported `max-params[1]: expected 3, got 5` for both logic probes after `max-params` was raised in `eslint.config.mjs`. `gate-diff.ts`, `commit-message-rules.ts` and `license-policy.ts` have 4, 5 and 5 passing Jest tests (21 tests in 7 suites across the sample repo, all under the jest-expo iOS preset).
- `npm run knip` passed after `updates.enabled: false` and an `expo-system-ui` dependency were added; it reported `expo-updates` and `expo-system-ui` before that.
- Reviewer knip check: with the final `knip.json`, a dead file in `packages/shell/src/ui/` and one in `packages/game-kit/src/` were reported, a root `__mocks__` export and the app entry were not, a path-referenced default-exported plugin passed once tagged `@public`, and the guardrail reported `knip.json.workspaces.packages/shell.includeEntryExports: expected true, got undefined` when the setting was removed. On the sample repo, knip now also lists the five doc samples that no screen imports yet (`ServicesProvider`, `BuyButton`, `createFakeErrorLog`, `useSettingsStore`, `LevelTile`), which is correct for a repo without screens.
- npm 11.17.0: `min-release-age`, `min-release-age-exclude[]`, `save-exact` and `npm ci`/lockfile behaviour as described in section 9.1; `npm approve-scripts --allow-scripts-pending` output and exit code as described in 9.2. `check-deps.ts` ran the docs/01 exclude check against the docs/01 `.npmrc` (no violations on 2026-09-26) and the lockstep check (2 passing tests) before reaching the per-app Expo checks.
- `audit-licenses.ts` read the probe's exported iOS source map (1,111 sources) and found 52 shipped npm packages (51 MIT, 1 ISC), all allowed.
- The workflow file passed actionlint 1.7.12. The Claude Code hook and permission semantics come from the current docs (fetched 2026-09-26); the hooks were exercised as shell commands with `CLAUDE_PROJECT_DIR` set, not inside a live Claude Code session.
- Reviewer re-check (same day, fresh copy in `scratchpad/rn/verify-conventions/repo`, with this doc's final `lefthook.yml`, `knip.json`, `.claude/settings.json`, `.gitignore` and `quality-gates.json`): `lefthook validate` passed; a staged root `.env` was refused by `no-secrets` (the earlier glob list missed it); knip passed with `cycles: error` (before the `includeEntryExports` change below), and the guardrail reported `knip.json.rules.cycles: expected "error", got "warn"` when it was lowered; the guardrail passed on the final files; the Stop-hook command exited 0 and `after-edit.ts` exited 2 on a bad file. The hook fields (`args` exec form, exit code 2, the 8-block Stop cap and `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`) and the permission syntax (`/path` anchored at the project, `*` anywhere in Bash rules, no parent-directory fallback for `.claude/settings.json`) match code.claude.com on 2026-09-26. `actions/checkout`, `setup-node` and `upload-artifact` all have a `v7` tag; the `macos-26` image lists Xcode 26.6 (default), iOS 26.5 simulators and `JAVA_HOME_17_arm64`.
- Re-verify: `npm view lefthook version`, `npm view knip version`, `npm --version` (the `approve-scripts` and `min-release-age` behaviour may change when npm starts blocking unreviewed scripts), `npx lefthook validate`, and `npm run verify`.

## Open issues

1. **Release-age cooldown on day one.** Ten or more pins chosen on 2026-09-26 (among them `expo` 57.0.25, `react-native-google-mobile-ads` 17.2.0, `expo-iap` 5.8.0, `prettier` 3.9.9, `knip` 6.38.0, `typescript-eslint` 8.70.1) were younger than 7 days, so a fresh resolution fails with `ETARGET`. docs/01 handles this with a dated bootstrap exclude block that expires on 2026-10-03; `check-deps.ts` enforces the expiry. After that date the block must be deleted, not extended.
2. **Guardrail vs. FINAL's wording.** FINAL D.42 calls it a "guardrail test". It is implemented as a tooling script run by `verify` (with unit tests for its pure part) rather than a Jest test, so it cannot be hidden by a Jest `testMatch` change and does not run Jest inside Jest.
3. **Pre-commit typecheck.** FINAL D.42 lists `tsc --noEmit` for pre-commit; in the monorepo a bare `tsc --noEmit` checks only the root program, so the hook runs `npm run -s typecheck` (all projects, incremental).
4. **Expo Claude plugin.** The merged settings keep `enabledPlugins.expo@claude-plugins-official` as the template has it. Its skills point at EAS Update, EAS Hosting and a remote MCP server that this project does not use. The owner should decide whether to keep it; if kept, AGENTS.md must forbid EAS and OTA updates.
5. **Jest config dependencies.** `knip` needs `babel-jest` (used by `jest.sim.config.js`) and `@stryker-mutator/core` as root devDependencies; the root `jest.setup.ts` imports app-installed native libraries (handled with `ignoreDependencies`). docs/07's `jest.config.js` keeps root `test/**` in its test roots (resolved).
6. **Resolved: other docs' script files and the tooling layout.** `i18n:verify` matches docs/10, `build:ios:sim` / `release:ios` match docs/14, and the paths for `audit:network`, `audit:privacy`, `e2e:ios`, `screenshots:ios` and `new-game` match docs/13, docs/07 and docs/02. Every tooling file, CLIs included, lives in an area folder `packages/tooling/src/<area>/` (docs/02 section 10); the integration pass moved docs/09's `render-art.ts` and `render-sfx-wav.ts` and docs/14's two root-level CLIs into area folders. If an area doc renames a file, update the script and `quality-gates.json` (`npmScripts` covers only the gate scripts) together.
7. **Requests from docs/09.** docs/09 wants `node packages/tooling/src/art/render-art.ts --app <id> --check` in `verify` for every app (stale generated icons) and wants `audit:licenses` to write the shipped-package list for the S11d screen. Neither is wired here yet, because the script did not exist in the verified repo; add them together with the `npmScripts` entry in `quality-gates.json` (`Gate-Change:`) once docs/09's script is in place.
