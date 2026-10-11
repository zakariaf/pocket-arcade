// packages/tooling/src/e2e/capture-screenshots-ios.ts
// `npm run screenshots:ios -- --app line-siege [--update] [--devices phone] [--langs en,fa] [--sim <purpose>] [--driver-port <n>]`
// (--help prints every option; --sim captures on this session's own e07-<purpose> and
// e07-<purpose>-tablet instead of the shared e07-shots-phone and e07-shots-tablet: screenshots-cli.ts)
// 4 languages x light/dark x phone/tablet. Maestro captures (it waits for the UI to settle); comparePng
// checks each PNG against apps/<game>/e2e/baselines/<device>/<lang>-<theme>[-<text size>]/<screen>.png.
// Every capture names its simulator's UDID and a driver port of its own (runMaestro). A combination
// that fails is recorded and the next one still runs (screenshot-matrix.ts): summary.json and the
// gallery are always written, and the run exits 1 with the list of failed combinations; a bad
// command line or a missing build exits 2 with the message and no stack.
import { execFileSync } from 'node:child_process';
import { copyFileSync, globSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

import { freeDriverPort } from '@e07/tooling/e2e/maestro-args.ts';
import {
  captureEach,
  captureFailureRow,
  matrixOutcome,
} from '@e07/tooling/e2e/screenshot-matrix.ts';
import { NEW_BASELINE, writeGallery, type GalleryRow } from '@e07/tooling/e2e/write-gallery.ts';
import { comparePng } from '@e07/tooling/visual/compare-png.ts';

import { parseScreenshotsCli, SCREENSHOTS_USAGE, shotSimulatorName } from './screenshots-cli.ts';
import {
  e2eSimctl,
  findSimulatorBuild,
  prepareSimulator,
  readAppInfo,
  runMaestro,
  setAppearance,
  startSimulator,
  waitForBoot,
  type AppInfo,
  type MaestroDevice,
  type Simctl,
} from './simulator.ts';

const MODELS = { phone: 'iPhone 17 Pro Max', tablet: 'iPad Pro 13-inch (M5)' } as const;
const DEFAULT_TEXT_SIZE = 'large';
const MAX_DIFF_RATIO = 0.002;

type Cli = {
  readonly game: string;
  readonly app: AppInfo;
  readonly flow: string;
  readonly isUpdate: boolean;
  readonly devices: readonly ('phone' | 'tablet')[];
  readonly langs: readonly string[];
  readonly textSize: string;
  /** --driver-port <n>: the session's own Maestro driver port (else one free port per simulator). */
  readonly driverPort: number | undefined;
  /** --sim <purpose>: this session's own simulators (else the shared capture simulators). */
  readonly sim: string | undefined;
};
type Combo = { readonly device: string; readonly lang: string; readonly theme: 'light' | 'dark' };

function comboDir(cli: Cli, combo: Combo): string {
  const suffix = cli.textSize === DEFAULT_TEXT_SIZE ? '' : `-${cli.textSize}`;
  return join(combo.device, `${combo.lang}-${combo.theme}${suffix}`);
}

const rawDir = (cli: Cli, combo: Combo): string =>
  join('reports', 'screenshots', 'raw', comboDir(cli, combo));

/** One combination's screenshots; a Maestro run that fails throws (its job's capture-failed row). */
async function capture(cli: Cli, device: MaestroDevice, combo: Combo): Promise<string[]> {
  const outDir = rawDir(cli, combo);
  const vars = {
    APP_ID: cli.app.id,
    APP_SCHEME: cli.app.scheme,
    LANG: combo.lang,
    THEME: combo.theme,
  };
  rmSync(outDir, { recursive: true, force: true });
  const status = await runMaestro(device, [
    ...['test', cli.flow, '--test-output-dir', outDir],
    ...Object.entries(vars).flatMap(([key, value]) => ['-e', `${key}=${value}`]),
  ]);
  if (status !== 0) throw new Error(`screenshots: maestro exited ${String(status)}, see ${outDir}`);
  return globSync(join(outDir, '**', '*.png'));
}

function check(cli: Cli, combo: Combo, actual: string): GalleryRow {
  const relativeDir = comboDir(cli, combo);
  const baseline = join('apps', cli.game, 'e2e', 'baselines', relativeDir, basename(actual));
  const label = `${relativeDir}/${basename(actual, '.png')}`;
  if (cli.isUpdate) {
    mkdirSync(join('apps', cli.game, 'e2e', 'baselines', relativeDir), { recursive: true });
    copyFileSync(actual, baseline);
    return { label, actual, baseline, result: NEW_BASELINE };
  }
  const diffPath = join('reports', 'screenshots', 'diff', relativeDir, basename(actual));
  const result = comparePng(readFileSync(actual), {
    baselinePath: baseline,
    diffPath,
    maxDiffRatio: MAX_DIFF_RATIO,
  });
  return { label, actual, baseline, result };
}

/** The command line, or the exit code when it asked for the usage or was wrong. */
function parseCli(): Cli | number {
  const parsed = parseScreenshotsCli(process.argv.slice(2));
  if (parsed.kind === 'help') {
    console.log(SCREENSHOTS_USAGE);
    return 0;
  }
  if (parsed.kind === 'error') {
    console.error(`screenshots:ios: ${parsed.message}\n${SCREENSHOTS_USAGE.split('\n')[0] ?? ''}`);
    return 2;
  }
  const { options } = parsed;
  return {
    ...options,
    app: readAppInfo(findSimulatorBuild(options.game, options.appPath)),
  };
}

const combosOf = (cli: Cli, device: 'phone' | 'tablet'): Combo[] =>
  (['light', 'dark'] as const).flatMap((theme) =>
    cli.langs.map((lang) => ({ device, lang, theme })),
  );

/** The combination's job: its label and folders, and its capture once `run` gets the simulator. */
function jobOf(cli: Cli, combo: Combo, run: () => Promise<GalleryRow[]>) {
  const relativeDir = comboDir(cli, combo);
  const baselineDir = join('apps', cli.game, 'e2e', 'baselines', relativeDir);
  return { label: relativeDir, outDir: rawDir(cli, combo), baselineDir, run };
}

/** A simulator that never got ready: each of its combinations fails with that error. */
async function startDevice(cli: Cli, simctl: Simctl, device: 'phone' | 'tablet') {
  const udid = startSimulator(simctl, shotSimulatorName(device, cli.sim), MODELS[device]);
  const sim = { simctl, udid };
  waitForBoot(sim);
  prepareSimulator(sim, cli.app, cli.textSize);
  // One driver port for every capture on this simulator: the session's own, else one free port.
  return { sim, maestroDevice: { udid, driverPort: cli.driverPort ?? (await freeDriverPort()) } };
}

async function runDevice(
  cli: Cli,
  simctl: Simctl,
  device: 'phone' | 'tablet',
): Promise<GalleryRow[]> {
  const combos = combosOf(cli, device);
  let started: Awaited<ReturnType<typeof startDevice>>;
  try {
    started = await startDevice(cli, simctl, device);
  } catch (error: unknown) {
    return combos.map((combo) =>
      captureFailureRow(
        jobOf(cli, combo, () => Promise.resolve([])),
        error,
      ),
    );
  }
  const { sim, maestroDevice } = started;
  return captureEach(
    combos.map((combo) =>
      jobOf(cli, combo, async () => {
        setAppearance(sim, combo.theme);
        const shots = await capture(cli, maestroDevice, combo);
        return shots.map((actual) => check(cli, combo, actual));
      }),
    ),
  );
}

async function main(): Promise<number> {
  const cli = parseCli();
  if (typeof cli === 'number') return cli;
  // Idempotent and checksum-verified, like the E2E runner: nobody installs Maestro by hand.
  execFileSync('bash', [join('packages', 'tooling', 'scripts', 'install-maestro.sh')], {
    stdio: 'ignore',
  });
  const simctl = e2eSimctl();
  const rows: GalleryRow[] = [];
  for (const device of cli.devices) rows.push(...(await runDevice(cli, simctl, device)));
  const summary = join('reports', 'screenshots', 'summary.json');
  mkdirSync(join('reports', 'screenshots'), { recursive: true });
  writeFileSync(summary, `${JSON.stringify(rows, null, 2)}\n`);
  const outcome = matrixOutcome(rows);
  const [counts, ...failures] = outcome.lines;
  console.warn(`${counts ?? ''}; gallery: ${writeGallery(rows)}`);
  for (const failure of failures) console.error(`screenshots:ios: ${failure}`);
  return outcome.exitCode;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    // A missing or ads-on build, or no Maestro: the message alone, like a usage error.
    console.error(`screenshots:ios: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 2;
  });
