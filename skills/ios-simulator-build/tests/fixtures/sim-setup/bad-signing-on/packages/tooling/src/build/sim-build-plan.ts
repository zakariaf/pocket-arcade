// packages/tooling/src/build/sim-build-plan.ts
// Pure parts of `npm run build:ios:sim`: arguments, variant environment, paths and commands.
import { join } from 'node:path';

import { resolveBuildVariant, type BuildVariant } from '@e07/shell/config/app-variant.ts';

export type SimBuildOptions = {
  readonly game: string;
  readonly variant: BuildVariant;
  readonly purpose: string;
};

const USAGE =
  'usage: npm run build:ios:sim -- --app <game-id> [--variant test|store] [--ads off|test|live] [--sim <purpose>]';
const FLAGS = new Set(['--app', '--variant', '--ads', '--sim']);

function readFlags(argv: readonly string[]): ReadonlyMap<string, string> {
  const flags = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index] ?? '';
    const value = argv[index + 1];
    if (!FLAGS.has(flag) || value === undefined || value.startsWith('--')) {
      throw new Error(`unexpected argument "${flag}". ${USAGE}`);
    }
    flags.set(flag, value);
  }
  return flags;
}

/** Parses the CLI; the variant rules are the ones app.config.ts applies (forbidden pairs throw). */
export function parseSimBuildArgs(argv: readonly string[]): SimBuildOptions {
  const flags = readFlags(argv);
  const game = flags.get('--app');
  if (game === undefined || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(game)) {
    throw new Error(`--app <game-id> is required (kebab-case folder under apps/). ${USAGE}`);
  }
  const appVariant = flags.get('--variant') ?? 'test';
  const variant = resolveBuildVariant({
    APP_VARIANT: appVariant,
    EXPO_PUBLIC_APP_VARIANT: appVariant,
    ADS_MODE: flags.get('--ads'),
  });
  return { game, variant, purpose: flags.get('--sim') ?? 'smoke' };
}

/** The three variables stay exported for the WHOLE run: prebuild, Constants and Metro read them. */
export function variantEnv(variant: BuildVariant): Record<string, string> {
  return {
    APP_VARIANT: variant.appVariant,
    EXPO_PUBLIC_APP_VARIANT: variant.appVariant,
    ADS_MODE: variant.adsMode,
  };
}

export const PREBUILD_ARGS = ['expo', 'prebuild', '--platform', 'ios', '--clean'] as const;

/** `ios/LineSiege.xcworkspace` -> `LineSiege` (the scheme comes from expo.name, spaces removed). */
export function schemeOf(workspaceFile: string): string {
  const name = workspaceFile.split('/').at(-1) ?? '';
  if (!name.endsWith('.xcworkspace')) {
    throw new Error(`${workspaceFile} is not an .xcworkspace`);
  }
  return name.slice(0, -'.xcworkspace'.length);
}

export type SimTarget = {
  readonly workspace: string;
  readonly scheme: string;
  readonly udid: string;
};

/** Release, simulator SDK, arm64 only, no signing, DerivedData inside apps/<game>/build/. */
export function xcodebuildSimArgs(target: SimTarget): string[] {
  return [
    ...['-workspace', target.workspace, '-scheme', target.scheme],
    ...['-configuration', 'Release', '-sdk', 'iphonesimulator'],
    ...['-destination', `id=${target.udid}`, '-derivedDataPath', join('build', 'dd')],
    ...['ONLY_ACTIVE_ARCH=YES', 'ARCHS=arm64', 'build'],
  ];
}

export function builtAppPath(appDir: string, scheme: string): string {
  return join(
    appDir,
    'build',
    'dd',
    'Build',
    'Products',
    'Release-iphonesimulator',
    `${scheme}.app`,
  );
}

export function screenshotPath(options: SimBuildOptions): string {
  const { appVariant, adsMode } = options.variant;
  return join('reports', 'ios', options.game, `smoke-${appVariant}-${adsMode}.png`);
}

/** Test builds write a cold-start entry to the perf log once Home is interactive. */
export function isColdStartLogged(perfLogPayload: string): boolean {
  return perfLogPayload.includes('cold-start');
}

export type ReadyProbe = {
  readonly attempt: number;
  readonly perfLog: string | null;
  readonly screenUnchanged: boolean;
};

export const READY_POLL_MS = 500;
export const READY_MAX_ATTEMPTS = 60;
const MIN_ATTEMPTS_FOR_STABLE_SCREEN = 6;

/**
 * Ready when the perf log says so; without a perf log (store builds, or a Shell that does not
 * write it yet) when two screenshots in a row are identical at least 3 s after launch.
 */
export function readyReason(probe: ReadyProbe): 'perf-log' | 'stable-screen' | null {
  if (probe.perfLog !== null && isColdStartLogged(probe.perfLog)) {
    return 'perf-log';
  }
  const hasWaitedLongEnough = probe.attempt >= MIN_ATTEMPTS_FOR_STABLE_SCREEN;
  return probe.perfLog === null && hasWaitedLongEnough && probe.screenUnchanged
    ? 'stable-screen'
    : null;
}
