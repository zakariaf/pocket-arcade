// packages/tooling/src/build/build-android-emu.ts
// CLI: npm run build:android:emu -- --app <game-id> [--variant test|store] [--ads off|test|live] [--avd <purpose>]
// (--help prints the usage). Preflight (JDK 17, the pinned SDK parts and the emulator image, else
// exit 2 before anything is touched), clean Android prebuild, Gradle assembleRelease (the Release
// APK embeds the JS bundle: no Metro), then the dedicated emulator e07-android-<purpose> on a free
// console port, targeted as emulator-<port> with adb -s in every call: wait for sys.boot_completed,
// pin the demo-mode status bar, install, launch, wait until ready (the perf log's cold start or a
// still screen, never a fixed sleep) and screenshot with adb exec-out screencap -p. Every step logs
// to apps/<game>/build/logs/<step>.log; the first failing step stops the run (exit 1).
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';

import {
  adb,
  screencap,
  startEmulator,
  toolsOf,
  waitForBoot,
  type Device,
} from '@e07/tooling/android/emulator-device.ts';
import { avdName } from '@e07/tooling/android/emulators.ts';
import { ANDROID_PINS, selectAndroidToolchain } from '@e07/tooling/android/toolchain.ts';
import {
  apkPath,
  EMU_BUILD_USAGE,
  gradleEmuArgs,
  installArgs,
  isHelpRequest,
  launchArgs,
  packageNameOf,
  parseEmuBuildArgs,
  PREBUILD_ANDROID_ARGS,
  READY_MAX_ATTEMPTS,
  READY_POLL_MS,
  readyReason,
  saveFolderOf,
  screenshotPath,
  variantEnv,
} from '@e07/tooling/build/emu-build-plan.ts';
import { nowEpochSeconds } from '@e07/tooling/clock/system-clock.ts';
import { readPerfLogPayload } from '@e07/tooling/ios/sim-app.ts';
import { runToolStep, sleepMs, tailOf } from '@e07/tooling/ios/tool-step.ts';

import type { StepCommand, StepContext } from '@e07/tooling/ios/tool-step.ts';

/** The repo or the Mac is not ready for a build (exit 2): nothing was prebuilt, built or started. */
class PreflightError extends Error {}

function runStep(name: string, command: StepCommand, context: StepContext): void {
  console.log(`build:android:emu: ${name} ...`);
  const result = runToolStep(name, command, context);
  if (result.status !== 0) {
    throw new Error(
      `step "${name}" failed (exit ${String(result.status)}), see ${result.logFile}:\n${tailOf(result.output, 30)}`,
    );
  }
}

/** Before the clean prebuild: the game, JDK 17, the SDK pins and the emulator's image. */
function preflight(appDir: string): NodeJS.ProcessEnv {
  if (!existsSync(join(appDir, 'app.config.ts'))) {
    throw new PreflightError(
      `${appDir}/app.config.ts not found: run from the repo root with an existing game`,
    );
  }
  let env: NodeJS.ProcessEnv;
  try {
    env = selectAndroidToolchain(process.env);
  } catch (error: unknown) {
    throw new PreflightError(
      `preflight failed, nothing was built: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const image = join(env['ANDROID_HOME'] ?? '', ...ANDROID_PINS.systemImage.split(';'));
  const tools = toolsOf(env);
  const missing = [image, tools.emulator, tools.avdmanager].filter((path) => !existsSync(path));
  if (missing.length > 0) {
    throw new PreflightError(
      `preflight failed, nothing was built: missing ${missing.join(', ')}; ask the owner, then sdkmanager "${ANDROID_PINS.systemImage}" "emulator" "cmdline-tools;latest" (a download)`,
    );
  }
  return env;
}

/** The perf log of a test build: save.db pulled with adb root (google_apis image), or null. */
function perfLogReader(device: Device, packageName: string, appDir: string): () => string | null {
  const local = join(appDir, 'build', 'emu-save');
  let isRoot = true;
  try {
    adb(device, ['root']);
    adb(device, ['wait-for-device']);
  } catch {
    isRoot = false;
  }
  return () => {
    if (!isRoot) return null;
    rmSync(local, { recursive: true, force: true });
    try {
      adb(device, ['pull', saveFolderOf(packageName), local]);
    } catch {
      return null;
    }
    return readPerfLogPayload(join(local, 'save.db'));
  };
}

type ReadyTarget = {
  readonly device: Device;
  readonly perfLog: () => string | null;
  readonly launchedAtEpochMs: number;
};

/** Polls every 500 ms (never a fixed sleep); only a cold start logged after this launch counts. */
function waitAndScreenshot(target: ReadyTarget, out: string): string {
  const { device, perfLog, launchedAtEpochMs } = target;
  mkdirSync(dirname(out), { recursive: true });
  let previous: Buffer | null = null;
  for (let attempt = 1; attempt <= READY_MAX_ATTEMPTS; attempt += 1) {
    sleepMs(READY_POLL_MS);
    const current = screencap(device, out);
    const isSame = previous?.equals(current) ?? false;
    const reason = readyReason({
      attempt,
      perfLog: perfLog(),
      screenUnchanged: isSame,
      launchedAtEpochMs,
    });
    if (reason !== null) {
      screencap(device, out);
      return reason;
    }
    previous = current;
  }
  throw new Error(
    `the app was not ready after ${String((READY_MAX_ATTEMPTS * READY_POLL_MS) / 1000)} s; look at ${out}`,
  );
}

function main(): number {
  const argv = process.argv.slice(2);
  if (isHelpRequest(argv)) {
    console.log(EMU_BUILD_USAGE);
    return 0;
  }
  const options = parseEmuBuildArgs(argv);
  const appDir = join('apps', options.game);
  const env = { ...preflight(appDir), ...variantEnv(options.variant) };
  const context = { appDir, env };
  runStep('prebuild', { file: 'npx', args: PREBUILD_ANDROID_ARGS }, context);
  runStep('gradle', { file: join('android', 'gradlew'), args: gradleEmuArgs() }, context);
  const apk = apkPath(appDir);
  const device = startEmulator(options.purpose, env, appDir);
  waitForBoot(device);
  const packageName = packageNameOf(options.game);
  adb(device, installArgs(apk));
  const perfLog = perfLogReader(device, packageName, appDir);
  const launchedAtEpochMs = nowEpochSeconds() * 1000;
  adb(device, launchArgs(packageName));
  const out = screenshotPath(options);
  const reason = waitAndScreenshot({ device, perfLog, launchedAtEpochMs }, out);
  console.log(
    `build:android:emu: ${options.variant.appVariant}/${options.variant.adsMode} apk ${apk}`,
  );
  console.log(
    `build:android:emu: ready (${reason}) on ${avdName(options.purpose)} ${device.serial}; screenshot ${out}`,
  );
  console.log(
    'build:android:emu: open the screenshot and look at it: white or black means the app failed.',
  );
  console.log(`build:android:emu: when done, shut it down with adb -s ${device.serial} emu kill`);
  return 0;
}

try {
  process.exitCode = main();
} catch (error: unknown) {
  console.error(`build:android:emu: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = error instanceof PreflightError ? 2 : 1;
}
