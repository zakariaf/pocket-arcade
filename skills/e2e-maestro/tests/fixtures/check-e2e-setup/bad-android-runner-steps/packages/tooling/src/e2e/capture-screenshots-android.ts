// packages/tooling/src/e2e/capture-screenshots-android.ts
// device-only: covered by npm run screenshots:android on e07-android-* emulators, then check-e2e-report --platform android --screenshots
// `npm run screenshots:android -- --app line-siege [--update] [--devices phone] [--langs en,fa] [--font-scale 2.0] [--avd <purpose>] [--driver-port <n>]`
// (--help prints every option, android-cli.ts). The same matrix flow as screenshots:ios, on an
// Android phone AVD and a tablet AVD (e07-android-shots-phone and -shots-tablet, or --avd's own),
// each with the animations off and the demo-mode status bar at 9:41 (stillScreenCommands), light and
// dark through cmd uimode night, font_scale 1.0 or 2.0. Each PNG is compared with
// apps/<game>/e2e/baselines-android/<device>/<lang>-<theme>[-font-scale-2.0]/<screen>.png (the iOS
// baselines stay apart) at the same tolerance, MAX_DIFF_RATIO = 0.002. A combination that fails is
// recorded and the next one still runs; reports/screenshots-android/summary.json and its gallery
// are always written; a bad command line or an APK that is not test/off exits 2 without a stack.
import { execFileSync } from 'node:child_process';
import { copyFileSync, globSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

import {
  ANDROID_SHOTS_USAGE,
  parseAndroidShotsCli,
  type AndroidShotsOptions,
} from '@e07/tooling/e2e/android-cli.ts';
import { fontScaleArgs, themeCommands } from '@e07/tooling/e2e/android-device-args.ts';
import {
  adbOn,
  androidAppEnv,
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
  captureEach,
  captureFailureRow,
  matrixOutcome,
} from '@e07/tooling/e2e/screenshot-matrix.ts';
import { MATRIX_FLOW, type MatrixDevice } from '@e07/tooling/e2e/screenshots-cli.ts';
import { NEW_BASELINE, writeGallery, type GalleryRow } from '@e07/tooling/e2e/write-gallery.ts';
import { comparePng } from '@e07/tooling/visual/compare-png.ts';

const MAX_DIFF_RATIO = 0.002;
const REPORTS = join('reports', 'screenshots-android');

type Cli = AndroidShotsOptions & { readonly app: AndroidApp };
type Combo = {
  readonly device: MatrixDevice;
  readonly lang: string;
  readonly theme: 'light' | 'dark';
};

const comboDir = (cli: Cli, combo: Combo): string =>
  join(
    combo.device,
    `${combo.lang}-${combo.theme}${cli.fontScale === '1.0' ? '' : `-font-scale-${cli.fontScale}`}`,
  );
const baselineDirOf = (cli: Cli, combo: Combo): string =>
  join('apps', cli.game, 'e2e', 'baselines-android', comboDir(cli, combo));
const rawDir = (cli: Cli, combo: Combo): string => join(REPORTS, 'raw', comboDir(cli, combo));

/** One combination's screenshots; a Maestro run that fails throws (its job's capture-failed row). */
async function capture(cli: Cli, maestro: AndroidMaestroDevice, combo: Combo): Promise<string[]> {
  const outDir = rawDir(cli, combo);
  rmSync(outDir, { recursive: true, force: true });
  const vars = ['-e', `LANG=${combo.lang}`, '-e', `THEME=${combo.theme}`];
  const status = await runMaestroAndroid(maestro, [
    'test',
    MATRIX_FLOW,
    '--test-output-dir',
    outDir,
    ...androidAppEnv(cli.app),
    ...vars,
  ]);
  if (status !== 0) throw new Error(`screenshots: maestro exited ${String(status)}, see ${outDir}`);
  return globSync(join(outDir, '**', '*.png'));
}

function check(cli: Cli, combo: Combo, actual: string): GalleryRow {
  const baselineDir = baselineDirOf(cli, combo);
  const baseline = join(baselineDir, basename(actual));
  const label = `${comboDir(cli, combo)}/${basename(actual, '.png')}`;
  if (cli.isUpdate) {
    mkdirSync(baselineDir, { recursive: true });
    copyFileSync(actual, baseline);
    return { label, actual, baseline, result: NEW_BASELINE };
  }
  const diffPath = join(REPORTS, 'diff', comboDir(cli, combo), basename(actual));
  const result = comparePng(readFileSync(actual), {
    baselinePath: baseline,
    diffPath,
    maxDiffRatio: MAX_DIFF_RATIO,
  });
  return { label, actual, baseline, result };
}

const jobOf = (cli: Cli, combo: Combo, run: () => Promise<GalleryRow[]>) => ({
  label: comboDir(cli, combo),
  outDir: rawDir(cli, combo),
  baselineDir: baselineDirOf(cli, combo),
  run,
});

const combosOf = (cli: Cli, device: MatrixDevice): Combo[] =>
  (['light', 'dark'] as const).flatMap((theme) =>
    cli.langs.map((lang) => ({ device, lang, theme })),
  );

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
  const combos = combosOf(cli, device);
  let started: Awaited<ReturnType<typeof startDevice>>;
  try {
    started = await startDevice(cli, device, env);
  } catch (error: unknown) {
    return combos.map((combo) =>
      captureFailureRow(
        jobOf(cli, combo, () => Promise.resolve([])),
        error,
      ),
    );
  }
  const { emulator, maestro } = started;
  return captureEach(
    combos.map((combo) =>
      jobOf(cli, combo, async () => {
        for (const args of themeCommands(emulator.serial, combo.theme)) adbOn(emulator, args);
        const shots = await capture(cli, maestro, combo);
        return shots.map((actual) => check(cli, combo, actual));
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
