// packages/tooling/src/build/build-ios-sim.ts
// CLI: npm run build:ios:sim -- --app <game-id> [--variant test|store] [--ads off|test|live] [--sim <purpose>] [--link <debug query>] [--driver-port <n>]
// (--help prints the usage). Preflight (every npm script the build runs has its target file),
// DerivedData from another folder dropped (a copied or moved repo), clean prebuild, audit:privacy
// (it reads ios/Pods), Release simulator build (no signing, arm64), then install, launch, wait
// until ready and screenshot on the dedicated simulator e07-<purpose>; with --link, open that
// debug link through Maestro's debug-setup sub-flow (it accepts iOS's "Open in <app>?" prompt,
// which `simctl openurl` alone leaves up; the Maestro run names --device <udid> and a driver port of
// its own before the command), wait until the screen holds still and screenshot it too. No Metro: Release embeds
// the bundle. Every step logs to apps/<game>/build/logs/<step>.log; the first failing step stops
// the run (exit 1). A failed preflight exits 2 before anything is touched.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';

import {
  buildScriptProblems,
  builtAppPath,
  findWorkspace,
  isHelpRequest,
  isStaleDerivedData,
  linkProblems,
  linkScreenshotPath,
  linkSetupArgs,
  MAESTRO_BIN,
  maestroEnvOf,
  moduleCachePathIn,
  parseSimBuildArgs,
  PREBUILD_ARGS,
  READY_MAX_ATTEMPTS,
  READY_POLL_MS,
  readyReason,
  schemeOf,
  screenshotPath,
  SIM_BUILD_USAGE,
  variantEnv,
  xcodebuildSimArgs,
  type ReadyProbeSince,
  type SimBuildOptions,
} from '@e07/tooling/build/sim-build-plan.ts';
import { nowEpochSeconds } from '@e07/tooling/clock/system-clock.ts';
import { freeDriverPort } from '@e07/tooling/e2e/maestro-args.ts';
import {
  readBundleId,
  readPerfLogPayload,
  readPlistValue,
  readUrlScheme,
  saveDatabaseOf,
} from '@e07/tooling/ios/sim-app.ts';
import {
  bootForScreenshots,
  createSimctl,
  DEFAULT_DEVICE_TYPE,
  ensureSimulator,
  installAndLaunch,
  type AppOnDisk,
  type Simctl,
} from '@e07/tooling/ios/simulators.ts';
import { runToolStep, sleepMs, tailOf } from '@e07/tooling/ios/tool-step.ts';
import { selectXcode } from '@e07/tooling/ios/toolchain.ts';

import type { StepCommand, StepContext } from '@e07/tooling/ios/tool-step.ts';

/** The repo is not ready for a build (exit 2): nothing was prebuilt, built or launched. */
class PreflightError extends Error {}

/** Runs one step with its output in build/logs/<step>.log; throws with the log's tail on failure. */
function runStep(name: string, command: StepCommand, context: StepContext): void {
  console.log(`build:ios:sim: ${name} ...`);
  const result = runToolStep(name, command, context);
  if (result.status !== 0) {
    throw new Error(
      `step "${name}" failed (exit ${String(result.status)}), see ${result.logFile}:\n${tailOf(result.output, 30)}`,
    );
  }
}

/** The path a DerivedData folder recorded: info.plist's WorkspacePath, else a .pcm's cache path. */
function recordedDerivedDataPath(dd: string, game: string): string | null {
  const info = join(dd, 'info.plist');
  if (existsSync(info)) return readPlistValue(info, 'WorkspacePath');
  const cache = join(dd, 'ModuleCache.noindex');
  const folders = existsSync(cache) ? readdirSync(cache, { withFileTypes: true }) : [];
  for (const folder of folders.filter((entry) => entry.isDirectory())) {
    const pcm = readdirSync(join(cache, folder.name)).find((name) => name.endsWith('.pcm'));
    if (pcm !== undefined) {
      return moduleCachePathIn(readFileSync(join(cache, folder.name, pcm), 'latin1'), game);
    }
  }
  return null;
}

/** A copied or moved repo keeps apps/<game>/build/dd, whose modules name the old folder. */
function dropStaleDerivedData(appDir: string, game: string): void {
  const dd = join(appDir, 'build', 'dd');
  if (!existsSync(dd)) return;
  const recorded = recordedDerivedDataPath(dd, game);
  if (!isStaleDerivedData(recorded, process.cwd(), game)) return;
  rmSync(dd, { recursive: true, force: true });
  console.log(`build:ios:sim: removed ${dd}: it was built in another folder (${String(recorded)})`);
}

/**
 * Polls every 500 ms (never a fixed sleep), then keeps the last screenshot. perfLog() null waits
 * for a still screen (at least 3 s, two identical screenshots in a row). launchedAtEpochMs: only
 * a cold-start entry from this launch counts (the log survives a reinstall).
 */
function waitAndScreenshot(
  simctl: Simctl,
  target: { readonly udid: string; readonly perfLog: () => string | null } & ReadyProbeSince,
  out: string,
): string {
  mkdirSync(dirname(out), { recursive: true });
  let previous: Buffer | null = null;
  for (let attempt = 1; attempt <= READY_MAX_ATTEMPTS; attempt += 1) {
    sleepMs(READY_POLL_MS);
    simctl(['io', target.udid, 'screenshot', out]);
    const current = readFileSync(out);
    const isSame = previous?.equals(current) ?? false;
    const probe = { ...target, attempt, perfLog: target.perfLog(), screenUnchanged: isSame };
    const reason = readyReason(probe);
    if (reason !== null) {
      simctl(['io', target.udid, 'screenshot', out]);
      return reason;
    }
    previous = current;
  }
  throw new Error(
    `the app was not ready after ${String((READY_MAX_ATTEMPTS * READY_POLL_MS) / 1000)} s; look at ${out}`,
  );
}

/** Before the clean prebuild: a missing audit script would fail the run only after it. */
function preflight(appDir: string, options: SimBuildOptions): void {
  if (!existsSync(join(appDir, 'app.config.ts'))) {
    throw new PreflightError(
      `${appDir}/app.config.ts not found: run from the repo root with an existing game`,
    );
  }
  const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
    scripts?: Record<string, string>;
  };
  const exists = (path: string): boolean => existsSync(path);
  const problems = [
    ...buildScriptProblems(pkg.scripts ?? {}, exists),
    ...linkProblems(options, exists),
  ];
  if (problems.length > 0) {
    throw new PreflightError(`preflight failed, nothing was built:\n  ${problems.join('\n  ')}`);
  }
}

/** audit:privacy reads ios/Pods, so it runs right after every prebuild (the release does too). */
function auditPrivacy(game: string, context: StepContext): void {
  const args = ['run', '-s', 'audit:privacy', '--', '--app', game];
  runStep('audit-privacy', { file: 'npm', args, atRoot: true }, context);
}

function buildApp(options: SimBuildOptions, context: StepContext, udid: string): AppOnDisk {
  runStep('prebuild', { file: 'npx', args: PREBUILD_ARGS }, context);
  auditPrivacy(options.game, context);
  const workspace = findWorkspace(readdirSync(join(context.appDir, 'ios')));
  const scheme = schemeOf(workspace);
  runStep(
    'xcodebuild',
    { file: 'xcodebuild', args: xcodebuildSimArgs({ workspace, scheme, udid }) },
    context,
  );
  const path = builtAppPath(join('apps', options.game), scheme);
  return { path, bundleId: readBundleId(path) };
}

type LinkTarget = AppOnDisk & { readonly udid: string; readonly env: NodeJS.ProcessEnv };

/** --link: the debug link through the setup sub-flow (the app keeps running), then a still screen. */
async function openLinkAndScreenshot(
  simctl: Simctl,
  app: LinkTarget,
  options: SimBuildOptions,
): Promise<void> {
  if (options.link === null) return;
  const scheme = readUrlScheme(app.path);
  const outDir = join('apps', options.game, 'build', 'logs', 'link');
  const driverPort = options.driverPort ?? (await freeDriverPort());
  const args = linkSetupArgs({ ...app, driverPort, scheme, link: options.link, outDir });
  console.log(`build:ios:sim: maestro on ${app.udid}, driver port ${String(driverPort)}`);
  const context = { appDir: join('apps', options.game), env: maestroEnvOf(app.env) };
  runStep('link', { file: MAESTRO_BIN, args, atRoot: true }, context);
  const out = linkScreenshotPath(options);
  // The perf log already holds the launch's cold start: here only a still screen counts.
  waitAndScreenshot(simctl, { udid: app.udid, perfLog: () => null }, out);
  console.log(
    `build:ios:sim: link screenshot ${out} (${options.link.query}); open it and look at it`,
  );
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  if (isHelpRequest(argv)) {
    console.log(SIM_BUILD_USAGE);
    return 0;
  }
  const options = parseSimBuildArgs(argv);
  const appDir = join('apps', options.game);
  preflight(appDir, options);
  dropStaleDerivedData(appDir, options.game);
  const env = { ...selectXcode(process.env), ...variantEnv(options.variant) };
  const simctl = createSimctl(env);
  const udid = ensureSimulator(simctl, options.purpose, DEFAULT_DEVICE_TYPE);
  const app = buildApp(options, { appDir, env }, udid);
  bootForScreenshots(simctl, udid);
  // The data container (and its perf log) survives the reinstall: only entries after this count.
  const launchedAtEpochMs = nowEpochSeconds() * 1000;
  installAndLaunch(simctl, udid, app);
  const out = screenshotPath(options);
  // The data container stays put once installed: look it up once, not on every poll.
  const container = simctl(['get_app_container', udid, app.bundleId, 'data']).trim();
  const database = saveDatabaseOf(container);
  const perfLog = (): string | null => readPerfLogPayload(database);
  const reason = waitAndScreenshot(simctl, { udid, perfLog, launchedAtEpochMs }, out);
  console.log(
    `build:ios:sim: ${options.variant.appVariant}/${options.variant.adsMode} app ${app.path}`,
  );
  console.log(
    `build:ios:sim: ready (${reason}) on e07-${options.purpose} ${udid}; screenshot ${out}`,
  );
  console.log(
    'build:ios:sim: open the screenshot and look at it: white or black means the app failed.',
  );
  await openLinkAndScreenshot(simctl, { ...app, udid, env }, options);
  return 0;
}

try {
  process.exitCode = await main();
} catch (error: unknown) {
  console.error(`build:ios:sim: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = error instanceof PreflightError ? 2 : 1;
}
