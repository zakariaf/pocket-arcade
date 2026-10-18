// packages/tooling/src/e2e/android-flow-steps.ts
// device-only: covered by npm run e2e:android on e07-android-* emulators (junit.xml, large-text/), then check-e2e-report --platform android
// The Maestro steps of `npm run e2e:android` (run-e2e-android.ts holds the run around them):
// 1. flows: every Shell and game flow but the a11y and offline ones; then the offline-tagged
//    journeys under real airplane mode (Maestro setAirplaneMode in subflows/airplane-mode.yaml,
//    guarded by platform: Android, turned off again whatever happens); then
//    smoke/04-debug-performance alone, its S15 save benchmark kept in save-benchmark.json right
//    after it. The three JUnit reports become one junit.xml. A tag filter (--include-tags, while
//    iterating) runs one call without airplane mode.
// 4. large text: the a11y flows at font_scale 2.0 in en and fa, on the phone, then on the tablet
//    (the phone's app stopped first, the tablet with a socket sampler of its own).
import { existsSync, globSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  DEFAULT_FONT_SCALE,
  fontScaleArgs,
  forceStopArgs,
  LARGE_FONT_SCALE,
} from '@e07/tooling/e2e/android-device-args.ts';
import {
  adbOn,
  androidAppEnv,
  runMaestroAndroid,
  startE2eEmulator,
  type AndroidApp,
  type AndroidMaestroDevice,
  type Device,
} from '@e07/tooling/e2e/android-e2e-device.ts';
import { mergeJunitReports } from '@e07/tooling/e2e/junit-merge.ts';
import { freeDriverPort } from '@e07/tooling/e2e/maestro-args.ts';
import {
  flowCallsOf,
  saveBenchmarkEvidenceOf,
  saveBenchmarkFileText,
} from '@e07/tooling/e2e/save-benchmark-evidence.ts';

import type { AndroidE2eOptions } from '@e07/tooling/e2e/android-cli.ts';

/** One e2e:android run: its options, the APK, the phone emulator and where its reports go. */
export type AndroidRun = {
  readonly cli: AndroidE2eOptions;
  readonly env: NodeJS.ProcessEnv;
  readonly app: AndroidApp;
  readonly phone: Device;
  readonly maestro: AndroidMaestroDevice;
  /** reports/e2e-android/<game-id> */
  readonly out: string;
  /** Starts a socket sampler on one more emulator of the run (the tablet of step 4). */
  readonly watch: (serial: string) => void;
  /** The test build's perf log (save.db pulled with adb root). */
  readonly readLog: () => unknown;
};

const AIRPLANE_FLOW = join('packages', 'shell', 'e2e', 'subflows', 'airplane-mode.yaml');
const LARGE_TEXT_LANGS = ['en', 'fa'] as const;
const EXCLUDE = '--exclude-tags';

const reportArgs = (dir: string): string[] => [
  ...['--format', 'JUNIT', '--output', join(dir, 'junit.xml'), '--test-output-dir', dir],
];

type FlowCall = {
  readonly flows: readonly string[];
  readonly dir: string;
  readonly tags: readonly string[];
};

/** One `maestro test` call of the flows step into `call.dir`; its exit code. */
function testFlows(run: AndroidRun, call: FlowCall): Promise<number> {
  mkdirSync(call.dir, { recursive: true });
  const { app, cli } = run;
  const args = ['test', ...call.flows, ...reportArgs(call.dir), ...call.tags];
  return runMaestroAndroid(run.maestro, [...args, ...androidAppEnv(app), ...cli.maestroArgs]);
}

/** Adds a call's test cases to junit.xml; a report that cannot be merged is a failure line. */
function mergeInto(out: string, dir: string): string | null {
  const extra = join(dir, 'junit.xml');
  if (!existsSync(extra)) return null; // Maestro wrote nothing: its exit code fails the step
  const junit = join(out, 'junit.xml');
  const main = existsSync(junit) ? readFileSync(junit, 'utf8') : '';
  try {
    writeFileSync(junit, mergeJunitReports(main, readFileSync(extra, 'utf8')));
    return null;
  } catch (error: unknown) {
    return `flows: ${error instanceof Error ? error.message : String(error)} (see ${dir})`;
  }
}

/** The offline journeys under real airplane mode, which is turned off again whatever happens. */
async function offlineFlows(run: AndroidRun, flows: readonly string[]): Promise<number> {
  const airplane = (mode: string): Promise<number> => {
    const args = ['test', AIRPLANE_FLOW, ...androidAppEnv(run.app), '-e', `AIRPLANE=${mode}`];
    return runMaestroAndroid(run.maestro, args);
  };
  if ((await airplane('enabled')) !== 0) return 1;
  try {
    const tags = ['--include-tags', 'offline', EXCLUDE, 'quarantine,a11y'];
    return await testFlows(run, { flows, dir: join(run.out, 'offline-flows'), tags });
  } finally {
    await airplane('disabled');
  }
}

/** Step 1; one failure line per failed call or unmergeable report. */
export async function runAndroidFlows(run: AndroidRun): Promise<string[]> {
  const { cli, out } = run;
  const flows = [
    ...globSync('packages/shell/e2e/flows/*/*.yaml'),
    ...globSync(`apps/${cli.game}/e2e/flows/*/*.yaml`),
  ].sort();
  const { others, benchmark } = flowCallsOf(flows, cli.maestroArgs);
  const isFiltered = cli.maestroArgs.length > 0;
  const excluded = isFiltered ? 'quarantine,a11y' : 'quarantine,a11y,offline';
  const statuses = [await testFlows(run, { flows: others, dir: out, tags: [EXCLUDE, excluded] })];
  const merges: (string | null)[] = [];
  if (!isFiltered) {
    statuses.push(await offlineFlows(run, others));
    merges.push(mergeInto(out, join(out, 'offline-flows')));
  }
  if (benchmark !== null) {
    const dir = join(out, 'save-benchmark-flow');
    statuses.push(await testFlows(run, { flows: [benchmark], dir, tags: [EXCLUDE, 'quarantine'] }));
    const evidence = saveBenchmarkEvidenceOf(run.readLog(), [benchmark]);
    writeFileSync(join(out, 'save-benchmark.json'), saveBenchmarkFileText(evidence));
    merges.push(mergeInto(out, dir));
  }
  const failed = statuses.filter((status) => status !== 0);
  return [
    ...failed.map((status) => `flows: maestro test exited ${String(status)}, see ${out}`),
    ...merges.filter((line): line is string => line !== null),
  ];
}

/** The tablet of step 4: the phone's app stopped first, a sampler of its own. */
function startTablet(run: AndroidRun): Device {
  adbOn(run.phone, forceStopArgs(run.phone.serial, run.app.id));
  const { cli, app } = run;
  const request = { purpose: cli.tabletAvd, device: 'tablet' as const, app, game: cli.game };
  const tablet = startE2eEmulator(request, run.env);
  run.watch(tablet.serial);
  return tablet;
}

/** The a11y flows at font_scale 2.0 on one emulator, in en and fa. */
async function largeTextOn(run: AndroidRun, key: string, maestro: AndroidMaestroDevice) {
  const flows = [
    ...globSync('packages/shell/e2e/flows/a11y/*.yaml'),
    ...globSync(`apps/${run.cli.game}/e2e/flows/a11y/*.yaml`),
  ].sort();
  const failures: string[] = [];
  for (const lang of LARGE_TEXT_LANGS) {
    const dir = join(run.out, 'large-text', `${key}-${lang}`);
    mkdirSync(dir, { recursive: true });
    const args = ['test', ...flows, ...reportArgs(dir), '--include-tags', 'a11y'];
    const env = [EXCLUDE, 'quarantine', ...androidAppEnv(run.app), '-e', `LANG=${lang}`];
    if ((await runMaestroAndroid(maestro, [...args, ...env])) !== 0) {
      failures.push(`large text: ${key} ${lang} failed, see ${dir}`);
    }
  }
  return failures;
}

/** Step 4: the phone, then the tablet; the font scale back to 1.0 afterwards. */
export async function runAndroidLargeText(run: AndroidRun): Promise<string[]> {
  const hasFlows =
    globSync('packages/shell/e2e/flows/a11y/*.yaml').length +
      globSync(`apps/${run.cli.game}/e2e/flows/a11y/*.yaml`).length >
    0;
  if (!hasFlows) return [];
  const failures: string[] = [];
  for (const key of ['phone', 'tablet'] as const) {
    const device = key === 'phone' ? run.phone : startTablet(run);
    const port = run.cli.driverPort ?? (await freeDriverPort());
    const maestro = key === 'phone' ? run.maestro : { serial: device.serial, driverPort: port };
    adbOn(device, fontScaleArgs(device.serial, LARGE_FONT_SCALE));
    failures.push(...(await largeTextOn(run, key, maestro)));
    adbOn(device, fontScaleArgs(device.serial, DEFAULT_FONT_SCALE));
    adbOn(device, forceStopArgs(device.serial, run.app.id));
  }
  return failures;
}
