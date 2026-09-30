// packages/tooling/src/build/sim-build-plan.ts
// Pure parts of `npm run build:ios:sim`: arguments, variant environment, paths and commands.
import { join } from 'node:path';

import { resolveBuildVariant, type BuildVariant } from '@e07/shell/config/app-variant.ts';

export type SimBuildOptions = {
  readonly game: string;
  readonly variant: BuildVariant;
  readonly purpose: string;
  /** --link: a debug-link query opened once the app is ready (test builds only), then shot. */
  readonly link: LinkRequest | null;
};

/** The debug link to open after launch and the testID that proves its screen is shown. */
export type LinkRequest = { readonly query: string; readonly waitFor: string };

/** --link goes through e2e-maestro's setup sub-flow, which accepts iOS's "Open in <app>?" prompt. */
export const MAESTRO_BIN = 'tools/maestro/bin/maestro';
export const LINK_SETUP_FLOW = 'packages/shell/e2e/subflows/debug-setup.yaml';

export const SIM_BUILD_USAGE = [
  'usage: npm run build:ios:sim -- --app <game-id> [--variant test|store] [--ads off|test|live] [--sim <purpose>] [--link <debug query> [--wait-for <testID>]]',
  '  --app      the game folder under apps/ (kebab-case)',
  '  --variant  test (default: debug menu, debug link, test-only code) or store',
  '  --ads      off, test (default for test builds) or live (store builds only)',
  '  --sim      the dedicated simulator e07-<purpose> (default smoke)',
  "  --link     after the launch screenshot, open <scheme>://debug/setup?<query> through Maestro's",
  "             debug-setup sub-flow (for example 'firstRun=0&level=1&screen=game'), wait for the",
  '             screen root, then until the screen holds still, and screenshot it too',
  "  --wait-for the testID that proves the link's screen (default: the root of its screen=)",
  '  --help, -h print this and exit',
].join('\n');
const FLAGS = new Set(['--app', '--variant', '--ads', '--sim', '--link', '--wait-for']);

/** --help or -h anywhere: print SIM_BUILD_USAGE and build nothing. */
export function isHelpRequest(argv: readonly string[]): boolean {
  return argv.includes('--help') || argv.includes('-h');
}

function readFlags(argv: readonly string[]): ReadonlyMap<string, string> {
  const flags = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index] ?? '';
    const value = argv[index + 1];
    if (!FLAGS.has(flag) || value === undefined || value.startsWith('--')) {
      throw new Error(`unexpected argument "${flag}". ${SIM_BUILD_USAGE}`);
    }
    flags.set(flag, value);
  }
  return flags;
}

/** The root testID of the link's screen= (a game example state shows game.screen or result.screen). */
export function linkWaitFor(query: string): string | null {
  const screen = /(?:^|&)screen=([a-z-]+)/.exec(query)?.[1];
  if (screen === undefined) return null;
  if (screen.startsWith('game-')) return 'game.screen';
  return screen.startsWith('result-') ? 'result.screen' : `${screen}.screen`;
}

/** --link takes the query only (name=value pairs), never a scheme or a leading '?'. */
function linkOf(flags: ReadonlyMap<string, string>, variant: BuildVariant): LinkRequest | null {
  const query = flags.get('--link');
  if (query === undefined) return null;
  if (!/^[A-Za-z]+=[^&\s']*(&[A-Za-z]+=[^&\s']*)*$/.test(query)) {
    throw new Error(`--link ${query}: pass the debug query only, such as 'firstRun=0&screen=home'`);
  }
  if (variant.appVariant === 'store') {
    throw new Error('--link needs a test build: a store build has no debug link');
  }
  const waitFor = flags.get('--wait-for') ?? linkWaitFor(query);
  if (waitFor === null) throw new Error(`--link ${query} has no screen=: add --wait-for <testID>`);
  return { query, waitFor };
}

/** Parses the CLI; the variant rules are the ones app.config.ts applies (forbidden pairs throw). */
export function parseSimBuildArgs(argv: readonly string[]): SimBuildOptions {
  const flags = readFlags(argv);
  const game = flags.get('--app');
  if (game === undefined || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(game)) {
    throw new Error(
      `--app <game-id> is required (kebab-case folder under apps/). ${SIM_BUILD_USAGE}`,
    );
  }
  const appVariant = flags.get('--variant') ?? 'test';
  const variant = resolveBuildVariant({
    APP_VARIANT: appVariant,
    EXPO_PUBLIC_APP_VARIANT: appVariant,
    ADS_MODE: flags.get('--ads'),
  });
  const link = linkOf(flags, variant);
  return { game, variant, purpose: flags.get('--sim') ?? 'smoke', link };
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

/**
 * The npm scripts the build runs, with the skill that ships each script's target. audit:privacy
 * reads ios/Pods, so it runs after every prebuild (the release does too) and is never skipped.
 */
export const SIM_BUILD_NPM_SCRIPTS: Readonly<Record<string, string>> = {
  'audit:privacy':
    "privacy-and-network-audit's tooling templates (packages/tooling/src/audit/ and packages/tooling/network-audit/)",
};

/** The repo files an npm script runs: every path-like argument ending in .ts, .mts, .js or .mjs. */
export function scriptTargetsOf(command: string): string[] {
  return command
    .split(/\s+/)
    .filter((word) => /^[\w@.-]+(\/[\w@.-]+)+\.(ts|mts|js|mjs)$/.test(word));
}

/**
 * Preflight, before the (slow, destructive) clean prebuild: each npm script the build runs must
 * exist and point at files that exist. One line per problem; empty when the build may start.
 */
export function buildScriptProblems(
  scripts: Readonly<Record<string, string>>,
  exists: (repoPath: string) => boolean,
): string[] {
  return Object.entries(SIM_BUILD_NPM_SCRIPTS).flatMap(([name, source]) => {
    const command = scripts[name];
    if (command === undefined) {
      return [`package.json has no "${name}" script; add it and install ${source}`];
    }
    return scriptTargetsOf(command)
      .filter((target) => !exists(target))
      .map((target) => `"${name}" runs ${target}, which does not exist; install ${source}`);
  });
}

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
    ...['ONLY_ACTIVE_ARCH=YES', 'ARCHS=arm64', 'CODE_SIGNING_ALLOWED=NO', 'build'],
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

/** What --link needs before the build starts: Maestro and the setup sub-flow (both e2e-maestro's). */
export function linkProblems(
  options: SimBuildOptions,
  exists: (path: string) => boolean,
): string[] {
  if (options.link === null) return [];
  return [MAESTRO_BIN, LINK_SETUP_FLOW]
    .filter((path) => !exists(path))
    .map(
      (path) => `--link runs ${path}, which does not exist (install e2e-maestro's tooling first)`,
    );
}

export type LinkRun = {
  readonly udid: string;
  readonly bundleId: string;
  readonly scheme: string;
  readonly link: LinkRequest;
  readonly outDir: string;
};

/** `maestro test` arguments: the setup sub-flow applies the link to the running app. */
export function linkSetupArgs(run: LinkRun): string[] {
  return [
    ...['test', LINK_SETUP_FLOW, '--udid', run.udid, '--test-output-dir', run.outDir],
    ...['-e', `APP_ID=${run.bundleId}`, '-e', `APP_SCHEME=${run.scheme}`],
    ...['-e', `QUERY=${run.link.query}`, '-e', `WAIT_FOR=${run.link.waitFor}`],
  ];
}

/** The screenshot taken after --link: next to the launch screenshot. */
export function linkScreenshotPath(options: SimBuildOptions): string {
  return screenshotPath(options).replace(/\.png$/, '-link.png');
}

/** /private/tmp and /tmp are one folder on macOS; DerivedData may record either spelling. */
const normalizedRoot = (path: string): string =>
  path.replace(/^\/private(?=\/)/, '').replace(/\/+$/, '');

/**
 * The repo root a DerivedData folder was built in, from a path it recorded (build/dd/info.plist's
 * WorkspacePath, or the module cache path inside a .pcm): the part before /apps/<game>/.
 */
export function recordedRepoRoot(recordedPath: string, game: string): string | null {
  const index = recordedPath.indexOf(`/apps/${game}/`);
  return index <= 0 ? null : normalizedRoot(recordedPath.slice(0, index));
}

/**
 * apps/<game>/build/dd was built in another folder (a copied or moved repo): its precompiled
 * modules name the old path ("was compiled with module cache path ...", "missing required module
 * 'SwiftShims'"), so the build deletes it first. Unknown or unreadable: keep it.
 */
export function isStaleDerivedData(
  recordedPath: string | null,
  repoRoot: string,
  game: string,
): boolean {
  const recorded = recordedPath === null ? null : recordedRepoRoot(recordedPath, game);
  return recorded !== null && recorded !== normalizedRoot(repoRoot);
}

/** The module cache path a .pcm file embeds (read as latin1), or null. */
export function moduleCachePathIn(pcmText: string, game: string): string | null {
  const escaped = game.replaceAll('-', '\\-');
  const pattern = new RegExp(`/[^\\s\\x00"]*?/apps/${escaped}/build/dd/ModuleCache\\.noindex/`);
  return pattern.exec(pcmText)?.[0] ?? null;
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
 * A test build's perf log exists from the first launch (createDebugParts makes it), but only Home
 * marks the cold start: a fresh install opens the first-run screens and never writes the entry.
 * So a perf log without the entry falls back to a still screen too, after a longer 8 s.
 */
const MIN_ATTEMPTS_WITHOUT_COLD_START = 16;

/**
 * Ready when the perf log has Home's cold-start entry; otherwise when two screenshots in a row are
 * identical at least 3 s after launch (no perf log: store builds, early Shells) or 8 s after launch
 * (a perf log without the entry: the first screen is not Home).
 */
export function readyReason(probe: ReadyProbe): 'perf-log' | 'stable-screen' | null {
  if (probe.perfLog !== null && isColdStartLogged(probe.perfLog)) {
    return 'perf-log';
  }
  const minAttempts =
    probe.perfLog === null ? MIN_ATTEMPTS_FOR_STABLE_SCREEN : MIN_ATTEMPTS_WITHOUT_COLD_START;
  return probe.attempt >= minAttempts && probe.screenUnchanged ? 'stable-screen' : null;
}
