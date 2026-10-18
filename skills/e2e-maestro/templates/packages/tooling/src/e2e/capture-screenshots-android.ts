// packages/tooling/src/e2e/capture-screenshots-android.ts
// device-only: covered by npm run screenshots:android on e07-android-* emulators, then check-e2e-report --platform android --screenshots
// `npm run screenshots:android -- --app line-siege [--update] [--devices phone] [--langs en,fa] [--font-scale 2.0] [--avd <purpose>] [--driver-port <n>]`
// (--help prints every option, android-cli.ts). The same matrix flow as screenshots:ios, on an
// Android phone AVD and a tablet AVD (e07-android-shots-phone and -shots-tablet, or --avd's own),
// each with the animations off and the demo-mode status bar at 9:41 (stillScreenCommands), light and
// dark through cmd uimode night, font_scale 1.0 or 2.0. Each PNG is compared with
// apps/<game>/e2e/baselines-android/<device>/<lang>-<theme>[-font-scale-2.0]/<screen>.png (the iOS
// baselines stay apart) at the same tolerance (screenshot-compare.ts). A combination that fails is
// recorded and the next one still runs; reports/screenshots-android/summary.json and its gallery
// are always written; a bad command line or an APK that is not test/off exits 2 without a stack.
import { execFileSync } from 'node:child_process';
import { globSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  ANDROID_SHOTS_USAGE,
  parseAndroidShotsCli,
  type AndroidShotsOptions,
} from '@e07/tooling/e2e/android-cli.ts';
import { fontScaleArgs, themeCommands } from '@e07/tooling/e2e/android-device-args.ts';
import {
  adbOn,
  androidEnv,
  readApkApp,
  runMaestroAndroid,
  startE2eEmulator,
  type AndroidApp,
  type AndroidMaestroDevice,
  type Device,
} from '@e07/tooling/e2e/android-e2e-device.ts';
import { freeDriverPort } from '@e07/tooling/e2e/maestro-args.ts';
import {
  checkShot,
  combosOf,
  jobOf,
  rawDirOf,
  type Combo,
  type ShotLayout,
} from '@e07/tooling/e2e/screenshot-compare.ts';
import {
  captureEach,
  captureFailureRow,
  matrixOutcome,
} from '@e07/tooling/e2e/screenshot-matrix.ts';
import { MATRIX_FLOW, type MatrixDevice } from '@e07/tooling/e2e/screenshots-cli.ts';
import { appEnv } from '@e07/tooling/e2e/simulator.ts';
import { writeGallery, type GalleryRow } from '@e07/tooling/e2e/write-gallery.ts';
import { comparePng } from '@e07/tooling/visual/compare-png.ts';

const REPORTS = join('reports', 'screenshots-android');

type Cli = AndroidShotsOptions & { readonly app: AndroidApp };

/** Android keeps baselines-android/ and reports/screenshots-android/ apart from iOS's. */
function layoutOf(cli: Cli): ShotLayout {
  return {
    game: cli.game,
    baselines: 'baselines-android',
    reports: REPORTS,
    suffix: cli.fontScale === '1.0' ? '' : `-font-scale-${cli.fontScale}`,
    isUpdate: cli.isUpdate,
    compare: comparePng,
  };
}

/** One combination's screenshots; a Maestro run that fails throws (its job's capture-failed row). */
async function capture(
  cli: Cli,
  target: { readonly maestro: AndroidMaestroDevice; readonly env: NodeJS.ProcessEnv },
  combo: Combo,
): Promise<string[]> {
  const outDir = rawDirOf(layoutOf(cli), combo);
  rmSync(outDir, { recursive: true, force: true });
  const vars = ['-e', `LANG=${combo.lang}`, '-e', `THEME=${combo.theme}`];
  const args = ['test', MATRIX_FLOW, '--test-output-dir', outDir, ...appEnv(cli.app), ...vars];
  const status = await runMaestroAndroid(target.maestro, args, target.env);
  if (status !== 0) throw new Error(`screenshots: maestro exited ${String(status)}, see ${outDir}`);
  return globSync(join(outDir, '**', '*.png'));
}

/** The device's emulator, its font scale and one driver port for every capture on it. */
async function startDevice(cli: Cli, device: MatrixDevice, env: NodeJS.ProcessEnv) {
  const emulator: Device = startE2eEmulator(
    { purpose: cli.avds[device], device, app: cli.app, game: cli.game },
    env,
  );
  adbOn(emulator, fontScaleArgs(emulator.serial, cli.fontScale));
  return {
    emulator,
    maestro: { serial: emulator.serial, driverPort: cli.driverPort ?? (await freeDriverPort()) },
  };
}

async function runDevice(
  cli: Cli,
  device: MatrixDevice,
  env: NodeJS.ProcessEnv,
): Promise<GalleryRow[]> {
  const layout = layoutOf(cli);
  const combos = combosOf(cli.langs, device);
  let started: Awaited<ReturnType<typeof startDevice>>;
  try {
    started = await startDevice(cli, device, env);
  } catch (error: unknown) {
    return combos.map((combo) =>
      captureFailureRow(
        jobOf(layout, combo, () => Promise.resolve([])),
        error,
      ),
    );
  }
  const { emulator, maestro } = started;
  return captureEach(
    combos.map((combo) =>
      jobOf(layout, combo, async () => {
        for (const args of themeCommands(emulator.serial, combo.theme)) adbOn(emulator, args);
        const shots = await capture(cli, { maestro, env }, combo);
        return shots.map((actual) => checkShot(layout, combo, actual));
      }),
    ),
  );
}

async function main(): Promise<number> {
  const parsed = parseAndroidShotsCli(process.argv.slice(2));
  if (parsed.kind === 'help') {
    console.log(ANDROID_SHOTS_USAGE);
    return 0;
  }
  if (parsed.kind === 'error') {
    console.error(
      `screenshots:android: ${parsed.message}\n${ANDROID_SHOTS_USAGE.split('\n')[0] ?? ''}`,
    );
    return 2;
  }
  const cli: Cli = { ...parsed.options, app: readApkApp(parsed.options.game, parsed.options.apk) };
  execFileSync('bash', [join('packages', 'tooling', 'scripts', 'install-maestro.sh')], {
    stdio: 'ignore',
  });
  const env = androidEnv();
  const rows: GalleryRow[] = [];
  for (const device of cli.devices) rows.push(...(await runDevice(cli, device, env)));
  mkdirSync(REPORTS, { recursive: true });
  writeFileSync(join(REPORTS, 'summary.json'), `${JSON.stringify(rows, null, 2)}\n`);
  const outcome = matrixOutcome(rows);
  const [counts, ...failures] = outcome.lines;
  console.warn(`${counts ?? ''}; gallery: ${writeGallery(rows, REPORTS)}`);
  for (const failure of failures) console.error(`screenshots:android: ${failure}`);
  return outcome.exitCode;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error(`screenshots:android: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 2;
  });
