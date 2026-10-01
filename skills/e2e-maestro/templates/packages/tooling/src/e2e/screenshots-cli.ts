// packages/tooling/src/e2e/screenshots-cli.ts
// The screenshots:ios command line, pure: --help prints every option, a bad command line is a usage
// error (exit 2, no stack), and --sim <purpose> captures on this session's own simulators
// (e07-<purpose> for the phone, e07-<purpose>-tablet for the iPad) instead of the shared
// e07-shots-phone and e07-shots-tablet, which another session may be using.
import { parseArgs } from 'node:util';

import { e2eSimulatorName, e2eTabletName } from './simulator.ts';

export const SCREENSHOTS_USAGE = [
  'usage: npm run screenshots:ios -- --app <game-id> [--update] [--devices phone,tablet] [--langs en,de,fa,ckb] [--text-size <size>] [--sim <purpose>] [--app-path <App.app>] [--driver-port <n>]',
  '  --app          the game folder under apps/ (kebab-case)',
  '  --update       write the captures as the new baselines (open every PNG, commit with Gate-Change:)',
  '  --devices      phone, tablet or both (default phone,tablet)',
  '  --langs        the languages (default en,de,fa,ckb)',
  '  --text-size    the simulator text size (default large; accessibility-extra-extra-extra-large: 200 %)',
  "  --sim          this session's own simulators e07-<purpose> and e07-<purpose>-tablet (default:",
  '                 the shared e07-shots-phone and e07-shots-tablet)',
  '  --app-path     the .app to capture (default: the Release simulator build of the game)',
  '  --driver-port  one Maestro driver port for every capture (default: a free port per capture)',
  '  --help, -h     print this and exit',
].join('\n');

export const MATRIX_DEVICES = ['phone', 'tablet'] as const;
export type MatrixDevice = (typeof MATRIX_DEVICES)[number];

export type ScreenshotsOptions = {
  readonly game: string;
  readonly appPath: string | undefined;
  readonly flow: string;
  readonly isUpdate: boolean;
  readonly devices: readonly MatrixDevice[];
  readonly langs: readonly string[];
  readonly textSize: string;
  readonly driverPort: number | undefined;
  readonly sim: string | undefined;
};

export type ScreenshotsCliParse =
  | { readonly kind: 'help' }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'run'; readonly options: ScreenshotsOptions };

const SHARED: Readonly<Record<MatrixDevice, string>> = {
  phone: 'e07-shots-phone',
  tablet: 'e07-shots-tablet',
};

/** The simulator a device's captures run on: this session's own with --sim, else the shared one. */
export function shotSimulatorName(device: MatrixDevice, sim: string | undefined): string {
  if (sim === undefined) return SHARED[device];
  return device === 'phone'
    ? e2eSimulatorName(sim, SHARED.phone)
    : e2eTabletName(sim, SHARED.tablet);
}

const isDevice = (value: string): value is MatrixDevice =>
  (MATRIX_DEVICES as readonly string[]).includes(value);

function readValues(argv: readonly string[]) {
  return parseArgs({
    args: [...argv],
    options: {
      app: { type: 'string' },
      'app-path': { type: 'string' },
      flow: { type: 'string', default: 'packages/shell/e2e/screenshots/matrix.yaml' },
      update: { type: 'boolean', default: false },
      devices: { type: 'string', default: 'phone,tablet' },
      langs: { type: 'string', default: 'en,de,fa,ckb' },
      'text-size': { type: 'string', default: 'large' },
      'driver-port': { type: 'string' },
      sim: { type: 'string' },
    },
  }).values;
}

/** The devices and the driver port of the command line, or the first problem. */
function checkedParts(
  values: ReturnType<typeof readValues>,
): { readonly devices: readonly MatrixDevice[]; readonly driverPort: number | undefined } | string {
  const devices = values.devices.split(',');
  const unknown = devices.find((device) => !isDevice(device));
  if (unknown !== undefined) return `unknown device ${unknown} (phone or tablet)`;
  const port = values['driver-port'];
  const driverPort = port === undefined ? undefined : Number(port);
  if (driverPort !== undefined && !(Number.isInteger(driverPort) && driverPort > 0)) {
    return `--driver-port ${String(port)} is not a port number`;
  }
  return { devices: devices.filter(isDevice), driverPort };
}

export function parseScreenshotsCli(argv: readonly string[]): ScreenshotsCliParse {
  if (argv.includes('--help') || argv.includes('-h')) return { kind: 'help' };
  let values: ReturnType<typeof readValues>;
  try {
    values = readValues(argv);
  } catch (error) {
    return { kind: 'error', message: error instanceof Error ? error.message : String(error) };
  }
  if (values.app === undefined) return { kind: 'error', message: 'missing --app <game-id>' };
  const parts = checkedParts(values);
  if (typeof parts === 'string') return { kind: 'error', message: parts };
  return {
    kind: 'run',
    options: {
      game: values.app,
      appPath: values['app-path'],
      flow: values.flow,
      isUpdate: values.update,
      devices: parts.devices,
      langs: values.langs.split(','),
      textSize: values['text-size'],
      driverPort: parts.driverPort,
      sim: values.sim,
    },
  };
}
