// packages/tooling/src/deps/check-deps.ts
// The dependency gate of `npm run verify`: dated release-age excludes, banned packages, app
// lockstep, Expo alignment per app (expo install --check, expo-doctor), reviewed install scripts.
// An Expo patch mismatch whose expected version is younger than 7 days is a WARN line with the day
// it becomes due (installing it now would break min-release-age=7); from that day on it fails.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { todayIso } from '@e07/tooling/clock/system-clock.ts';

import { findLockstepDrift, type AppManifest } from './app-lockstep.ts';
import { findBannedPackages, inventoryFromLockfile, type Lockfile } from './banned-packages.ts';
import {
  judgeMismatches,
  parseDoctor,
  parseInstallCheck,
  youngPatchWarnings,
  type VersionMismatch,
} from './expo-patch-age.ts';
import { checkReleaseAgeExcludes } from './release-age-excludes.ts';

const NO_PENDING = 'No packages with unreviewed install scripts.';

type Run = { readonly ok: boolean; readonly output: string };

function run(command: string, args: readonly string[], cwd: string): Run {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
  return { ok: result.status === 0, output: `${result.stdout}${result.stderr}` };
}

/** App folders only: macOS drops .DS_Store files next to them. */
function appFolders(): readonly string[] {
  return readdirSync('apps', { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => existsSync(path.join('apps', name, 'package.json')));
}

function releaseAgeProblems(): readonly string[] {
  const violations = checkReleaseAgeExcludes(readFileSync('.npmrc', 'utf8'), todayIso());
  return violations.map((violation) =>
    `.npmrc line ${String(violation.line)}: ${violation.problem} ${violation.pattern}`.trim(),
  );
}

function bannedProblems(): readonly string[] {
  const lockfile = JSON.parse(readFileSync('package-lock.json', 'utf8')) as Lockfile;
  return findBannedPackages(inventoryFromLockfile(lockfile)).map(
    (hit) => `banned package ${hit.name}: ${hit.reason}`,
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

type Findings = { readonly problems: readonly string[]; readonly warnings: readonly string[] };

const publishTimes = new Map<string, Readonly<Record<string, string>>>();

/** When npm published name@version (npm view <name> time --json, read once per package). */
function publishedAt(name: string, version: string): string | null {
  if (!publishTimes.has(name)) {
    const result = run('npm', ['view', name, 'time', '--json'], '.');
    publishTimes.set(name, result.ok ? (JSON.parse(result.output) as Record<string, string>) : {});
  }
  return publishTimes.get(name)?.[version] ?? null;
}

const EXPO_CHECKS: readonly {
  readonly label: string;
  readonly args: readonly string[];
  readonly parse: (output: string) => readonly VersionMismatch[] | null;
}[] = [
  { label: 'expo install --check', args: ['expo', 'install', '--check'], parse: parseInstallCheck },
  { label: 'expo-doctor', args: ['expo-doctor'], parse: parseDoctor },
];

function expoFindings(apps: readonly string[], today: string): Findings {
  const problems: string[] = [];
  const warnings: string[] = [];
  for (const app of apps) {
    for (const check of EXPO_CHECKS) {
      const result = run('npx', check.args, path.join('apps', app));
      const verdict = result.ok
        ? null
        : judgeMismatches(check.parse(result.output), publishedAt, today);
      if (verdict?.kind === 'young-patches') {
        warnings.push(...youngPatchWarnings(`${app}: ${check.label}`, verdict.patches));
      } else if (verdict?.kind === 'due') {
        problems.push(`${app}: ${check.label} failed\n${result.output}`);
      }
    }
  }
  return { problems, warnings };
}

function installScriptProblems(): readonly string[] {
  const pending = run('npm', ['approve-scripts', '--allow-scripts-pending'], '.');
  return pending.output.includes(NO_PENDING)
    ? []
    : [`review install scripts, then run npm approve-scripts <pkg>\n${pending.output}`];
}

function main(): number {
  const apps = appFolders();
  const expo = expoFindings(apps, todayIso());
  const problems = [
    ...releaseAgeProblems(),
    ...bannedProblems(),
    ...lockstepProblems(apps),
    ...expo.problems,
    ...installScriptProblems(),
  ];
  for (const warning of expo.warnings) {
    console.warn(`check-deps: ${warning}`);
  }
  for (const problem of problems) {
    console.error(`check-deps: ${problem}`);
  }
  return problems.length === 0 ? 0 : 1;
}

process.exitCode = main();
