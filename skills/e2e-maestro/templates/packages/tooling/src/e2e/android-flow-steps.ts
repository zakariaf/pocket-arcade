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
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { underAirplaneMode } from '@e07/tooling/e2e/airplane-mode.ts';
import {
  DEFAULT_FONT_SCALE,
  fontScaleArgs,
  forceStopArgs,
  LARGE_FONT_SCALE,
} from '@e07/tooling/e2e/android-device-args.ts';
import {
  adbOn,
  runMaestroAndroid,
  startE2eEmulator,
  type AndroidApp,
  type AndroidMaestroDevice,
  type Device,
} from '@e07/tooling/e2e/android-e2e-device.ts';
import {
  allFlows,
  largeTextFlows,
  mergeJunitInto,
  reportArgs,
} from '@e07/tooling/e2e/flow-files.ts';
import { freeDriverPort } from '@e07/tooling/e2e/maestro-args.ts';
import {
  flowCallsOf,
  saveBenchmarkEvidenceOf,
  saveBenchmarkFileText,
} from '@e07/tooling/e2e/save-benchmark-evidence.ts';
import { appEnv } from '@e07/tooling/e2e/simulator.ts';

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
  return runMaestroAndroid(run.maestro, [...args, ...appEnv(app), ...cli.maestroArgs], run.env);
}

/** The offline journeys under real airplane mode, which is turned off again whatever happens. */
async function offlineFlows(run: AndroidRun, flows: readonly string[]): Promise<number> {
  const airplane = (mode: string): Promise<number> => {
    const args = ['test', AIRPLANE_FLOW, ...appEnv(run.app), '-e', `AIRPLANE=${mode}`];
    return runMaestroAndroid(run.maestro, args, run.env);
  };
  const tags = ['--include-tags', 'offline', EXCLUDE, 'quarantine,a11y'];
  return underAirplaneMode(airplane, () =>
    testFlows(run, { flows, dir: join(run.out, 'offline-flows'), tags }),
  );
}

/** Step 1; one failure line per failed call or unmergeable report. */
export async function runAndroidFlows(run: AndroidRun): Promise<string[]> {
  const { cli, out } = run;
  const { others, benchmark } = flowCallsOf(allFlows(cli.game), cli.maestroArgs);
  const isFiltered = cli.maestroArgs.length > 0;
  const excluded = isFiltered ? 'quarantine,a11y' : 'quarantine,a11y,offline';
  const statuses = [await testFlows(run, { flows: others, dir: out, tags: [EXCLUDE, excluded] })];
  const merges: (string | null)[] = [];
  if (!isFiltered) {
    statuses.push(await offlineFlows(run, others));
    merges.push(mergeJunitInto(out, join(out, 'offline-flows')));
  }
  if (benchmark !== null) {
    const dir = join(out, 'save-benchmark-flow');
    statuses.push(await testFlows(run, { flows: [benchmark], dir, tags: [EXCLUDE, 'quarantine'] }));
    const evidence = saveBenchmarkEvidenceOf(run.readLog(), [benchmark]);
    writeFileSync(join(out, 'save-benchmark.json'), saveBenchmarkFileText(evidence));
    merges.push(mergeJunitInto(out, dir));
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

/** One emulator of step 4: the a11y flows at font_scale 2.0 in en and fa, then back to 1.0. */
type LargeTextTarget = {
  readonly key: 'phone' | 'tablet';
  readonly device: Device;
  readonly maestro: AndroidMaestroDevice;
};

async function largeTextOn(
  run: AndroidRun,
  flows: readonly string[],
  target: LargeTextTarget,
): Promise<string[]> {
  const { key, device, maestro } = target;
  adbOn(device, fontScaleArgs(device.serial, LARGE_FONT_SCALE));
  const failures: string[] = [];
  for (const lang of LARGE_TEXT_LANGS) {
    const dir = join(run.out, 'large-text', `${key}-${lang}`);
    mkdirSync(dir, { recursive: true });
    const args = ['test', ...flows, ...reportArgs(dir), '--include-tags', 'a11y'];
    const env = [EXCLUDE, 'quarantine', ...appEnv(run.app), '-e', `LANG=${lang}`];
    if ((await runMaestroAndroid(maestro, [...args, ...env], run.env)) !== 0) {
      failures.push(`large text: ${key} ${lang} failed, see ${dir}`);
    }
  }
  adbOn(device, fontScaleArgs(device.serial, DEFAULT_FONT_SCALE));
  adbOn(device, forceStopArgs(device.serial, run.app.id));
  return failures;
}

/** Step 4: the phone, then the tablet (its own driver port); the a11y flows are listed once. */
export async function runAndroidLargeText(run: AndroidRun): Promise<string[]> {
  const flows = largeTextFlows(run.cli.game);
  if (flows.length === 0) return [];
  const onPhone = { key: 'phone', device: run.phone, maestro: run.maestro } as const;
  const failures = await largeTextOn(run, flows, onPhone);
  const tablet = startTablet(run);
  const driverPort = run.cli.driverPort ?? (await freeDriverPort());
  const onTablet = {
    key: 'tablet',
    device: tablet,
    maestro: { serial: tablet.serial, driverPort },
  } as const;
  return [...failures, ...(await largeTextOn(run, flows, onTablet))];
}
