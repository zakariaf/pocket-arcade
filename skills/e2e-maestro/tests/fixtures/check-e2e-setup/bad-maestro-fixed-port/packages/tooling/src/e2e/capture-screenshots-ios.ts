// packages/tooling/src/e2e/capture-screenshots-ios.ts
// `npm run screenshots:ios -- --app line-siege [--update] [--devices phone] [--langs en,fa] [--driver-port <n>]`
// 4 languages x light/dark x phone/tablet. Maestro captures (it waits for the UI to settle); comparePng
// checks each PNG against apps/<game>/e2e/baselines/<device>/<lang>-<theme>[-<text size>]/<screen>.png.
// Every capture names its simulator's UDID and a driver port of its own (runMaestro).
import { execFileSync } from 'node:child_process';
import { copyFileSync, globSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { parseArgs } from 'node:util';

import {
  isChanged,
  NEW_BASELINE,
  writeGallery,
  type GalleryRow,
} from '@e07/tooling/e2e/write-gallery.ts';
import { comparePng } from '@e07/tooling/visual/compare-png.ts';

import {
  ensureSimulator,
  findSimulatorBuild,
  prepareSimulator,
  readAppInfo,
  runMaestro,
  setAppearance,
  type AppInfo,
} from './simulator.ts';

const DEVICES: Readonly<Record<string, { readonly name: string; readonly model: string }>> = {
  phone: { name: 'e07-shots-phone', model: 'iPhone 17 Pro Max' },
  tablet: { name: 'e07-shots-tablet', model: 'iPad Pro 13-inch (M5)' },
};
const DEFAULT_TEXT_SIZE = 'large';
const MAX_DIFF_RATIO = 0.002;

type Cli = {
  readonly game: string;
  readonly app: AppInfo;
  readonly flow: string;
  readonly isUpdate: boolean;
  readonly devices: readonly string[];
  readonly langs: readonly string[];
  readonly textSize: string;
  /** --driver-port <n>: the session's own Maestro driver port (else a free one per capture). */
  readonly driverPort: number | undefined;
};
type Combo = { readonly device: string; readonly lang: string; readonly theme: 'light' | 'dark' };

function comboDir(cli: Cli, combo: Combo): string {
  const suffix = cli.textSize === DEFAULT_TEXT_SIZE ? '' : `-${cli.textSize}`;
  return join(combo.device, `${combo.lang}-${combo.theme}${suffix}`);
}

async function capture(cli: Cli, udid: string, combo: Combo): Promise<string[]> {
  const outDir = join('reports', 'screenshots', 'raw', comboDir(cli, combo));
  const vars = {
    APP_ID: cli.app.id,
    APP_SCHEME: cli.app.scheme,
    LANG: combo.lang,
    THEME: combo.theme,
  };
  rmSync(outDir, { recursive: true, force: true });
  const status = await runMaestro({ udid, driverPort: 7001 }, [
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

function parseCli(): Cli {
  const { values } = parseArgs({
    options: {
      app: { type: 'string' },
      'app-path': { type: 'string' },
      flow: {
        type: 'string',
        default: join('packages', 'shell', 'e2e', 'screenshots', 'matrix.yaml'),
      },
      update: { type: 'boolean', default: false },
      devices: { type: 'string', default: 'phone,tablet' },
      langs: { type: 'string', default: 'en,de,fa,ckb' },
      'text-size': { type: 'string', default: DEFAULT_TEXT_SIZE },
      'driver-port': { type: 'string' },
    },
  });
  if (values.app === undefined) {
    throw new Error('usage: npm run screenshots:ios -- --app <game-id> [--update]');
  }
  return {
    game: values.app,
    app: readAppInfo(findSimulatorBuild(values.app, values['app-path'])),
    flow: values.flow,
    isUpdate: values.update,
    devices: values.devices.split(','),
    langs: values.langs.split(','),
    textSize: values['text-size'],
    driverPort: values['driver-port'] === undefined ? undefined : Number(values['driver-port']),
  };
}

async function runDevice(cli: Cli, device: string): Promise<GalleryRow[]> {
  const spec = DEVICES[device];
  if (spec === undefined) {
    throw new Error(`unknown device ${device}`);
  }
  const udid = ensureSimulator(spec.name, spec.model);
  prepareSimulator(udid, cli.app, cli.textSize);
  const rows: GalleryRow[] = [];
  for (const theme of ['light', 'dark'] as const) {
    setAppearance(udid, theme);
    for (const lang of cli.langs) {
      const combo = { device, lang, theme };
      rows.push(...(await capture(cli, udid, combo)).map((actual) => check(cli, combo, actual)));
    }
  }
  return rows;
}

// Idempotent and checksum-verified, like the E2E runner: nobody installs Maestro by hand.
execFileSync('bash', [join('packages', 'tooling', 'scripts', 'install-maestro.sh')], {
  stdio: 'ignore',
});
const cli = parseCli();
const rows: GalleryRow[] = [];
for (const device of cli.devices) rows.push(...(await runDevice(cli, device)));
writeFileSync(join('reports', 'screenshots', 'summary.json'), `${JSON.stringify(rows, null, 2)}\n`);
const changed = rows.filter(({ result }) => isChanged(result));
console.warn(
  `${String(rows.length)} screenshots, ${String(changed.length)} changed; gallery: ${writeGallery(rows)}`,
);
process.exitCode = changed.length === 0 ? 0 : 1;
