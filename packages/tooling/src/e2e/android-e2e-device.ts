// packages/tooling/src/e2e/android-e2e-device.ts
// device-only: covered by npm run e2e:android and npm run screenshots:android on e07-android-* emulators, then check-e2e-report --platform android
// The emulator side of e2e:android and screenshots:android, on android-emulator-build's emulator
// layer (startEmulator, waitForBoot, adb: every call -s <serial>). Dedicated AVDs
// only, e07-android-<purpose> on the pinned google_apis image (created once with the phone or
// tablet profile); the APK is refused unless it is the test variant with ADS_MODE=off; every
// Maestro run names its emulator and a driver port of its own (androidMaestroGlobalArgs) first.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  adb,
  startEmulator,
  waitForBoot,
  type Device,
} from '@e07/tooling/android/emulator-device.ts';
import { selectAndroidToolchain } from '@e07/tooling/android/toolchain.ts';
import { apkPath, installArgs, packageNameOf } from '@e07/tooling/build/emu-build-plan.ts';
import { apkVariantProblem } from '@e07/tooling/e2e/android-cli.ts';
import {
  androidMaestroGlobalArgs,
  androidMaestroRunLine,
  stillScreenCommands,
} from '@e07/tooling/e2e/android-device-args.ts';
import { freeDriverPort } from '@e07/tooling/e2e/maestro-args.ts';
import { MAESTRO_BIN, maestroEnvOf } from '@e07/tooling/ios/maestro-tool.ts';

export type { Device } from '@e07/tooling/android/emulator-device.ts';

/** The APK under test: its path, package (the flows' APP_ID) and URL scheme (APP_SCHEME). */
export type AndroidApp = { readonly apk: string; readonly id: string; readonly scheme: string };

/** avdmanager device profiles of the two matrix devices. */
const AVD_PROFILES = { phone: 'pixel_8', tablet: 'pixel_tablet' } as const;

/** JDK 17 and the pinned SDK for every tool of the run (android-emulator-build's toolchain). */
export function androidEnv(): NodeJS.ProcessEnv {
  return selectAndroidToolchain(process.env);
}

/** The APK (--apk, else the Release build of the game), refused unless it is test/off. */
export function readApkApp(game: string, override: string | undefined): AndroidApp {
  const apk = override ?? apkPath(join('apps', game));
  if (!existsSync(apk)) {
    throw new Error(
      `no APK at ${apk}: run npm run build:android:emu -- --app ${game} --variant test --ads off`,
    );
  }
  const config = execFileSync('unzip', ['-p', apk, 'assets/app.config'], { encoding: 'utf8' });
  const problem = apkVariantProblem(config, game);
  if (problem !== null) throw new Error(problem);
  const parsed = JSON.parse(config) as {
    readonly scheme?: string | readonly string[];
    readonly android?: { readonly package?: string };
  };
  const scheme = typeof parsed.scheme === 'string' ? parsed.scheme : parsed.scheme?.[0];
  return { apk, id: parsed.android?.package ?? packageNameOf(game), scheme: String(scheme) };
}

/** Runs adb arguments a builder made for this emulator (-s <serial> first, checked). */
export function adbOn(device: Device, args: readonly string[]): string {
  const [flag, serial, ...rest] = args;
  if (flag !== '-s' || serial !== device.serial) {
    throw new Error(`adb arguments for ${String(serial)} sent to ${device.serial}`);
  }
  return adb(device, rest);
}

export type EmulatorRequest = {
  readonly purpose: string;
  readonly device: keyof typeof AVD_PROFILES;
  readonly app: AndroidApp;
  readonly game: string;
};

/**
 * The emulator of one device of the run: created once with the device's profile, started on a free
 * console port (or reused when it already runs), booted, the animations off and the demo status
 * bar at 9:41, the APK installed.
 */
export function startE2eEmulator(request: EmulatorRequest, env: NodeJS.ProcessEnv): Device {
  const appDir = join('apps', request.game);
  const device = startEmulator(request.purpose, env, {
    appDir,
    profile: AVD_PROFILES[request.device],
  });
  waitForBoot(device);
  for (const args of stillScreenCommands(device.serial)) adbOn(device, args);
  adb(device, installArgs(request.app.apk));
  return device;
}

/** Where a Maestro run goes: the emulator and, when the session passes its own, a driver port. */
export type AndroidMaestroDevice = { readonly serial: string; readonly driverPort?: number };

/**
 * `maestro --device <serial> --driver-host-port <port> <args>`: Maestro's exit code. `env` is the
 * run's toolchain env (androidEnv, made once per run), with Maestro's no-telemetry settings added.
 */
export async function runMaestroAndroid(
  device: AndroidMaestroDevice,
  args: readonly string[],
  env: NodeJS.ProcessEnv,
): Promise<number> {
  const target = {
    serial: device.serial,
    driverPort: device.driverPort ?? (await freeDriverPort()),
  };
  console.log(androidMaestroRunLine(target, args));
  const command = [...androidMaestroGlobalArgs(target), ...args];
  return spawnSync(MAESTRO_BIN, command, { stdio: 'inherit', env: maestroEnvOf(env) }).status ?? 1;
}
