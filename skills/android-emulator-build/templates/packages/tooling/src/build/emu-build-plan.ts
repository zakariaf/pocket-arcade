// packages/tooling/src/build/emu-build-plan.ts
// Pure parts of `npm run build:android:emu`: arguments, variant environment, commands and paths.
// The variant rules and the ready rule are the iOS build's (sim-build-plan.ts), so both platforms
// build and judge a variant the same way.
import { join } from 'node:path';

import { resolveBuildVariant, type BuildVariant } from '@e07/shell/config/app-variant.ts';
import { readFlagPairs } from '@e07/tooling/build/flag-pairs.ts';
import { isGameId } from '@e07/tooling/build/game-id.ts';

export {
  isHelpRequest,
  READY_MAX_ATTEMPTS,
  READY_POLL_MS,
  readyReason,
  variantEnv,
} from '@e07/tooling/build/sim-build-plan.ts';

export type EmuBuildOptions = {
  readonly game: string;
  readonly variant: BuildVariant;
  readonly purpose: string;
};

export const EMU_BUILD_USAGE = [
  'usage: npm run build:android:emu -- --app <game-id> [--variant test|store] [--ads off|test|live] [--avd <purpose>]',
  '  --app      the game folder under apps/ (kebab-case)',
  '  --variant  test (default: debug menu, debug link, test-only code) or store',
  '  --ads      off, test (default for test builds) or live (store builds only)',
  '  --avd      the dedicated emulator e07-android-<purpose> (default smoke), started on a free',
  '             console port and targeted as emulator-<port> in every adb call',
  '  --help, -h print this and exit',
].join('\n');

const FLAGS = new Set(['--app', '--variant', '--ads', '--avd']);

/** Parses the CLI; the variant rules are the ones app.config.ts applies (forbidden pairs throw). */
export function parseEmuBuildArgs(argv: readonly string[]): EmuBuildOptions {
  const flags = readFlagPairs(argv, FLAGS, EMU_BUILD_USAGE);
  const game = flags.get('--app');
  if (!isGameId(game)) {
    throw new Error(
      `--app <game-id> is required (kebab-case folder under apps/). ${EMU_BUILD_USAGE}`,
    );
  }
  const appVariant = flags.get('--variant') ?? 'test';
  const variant = resolveBuildVariant({
    APP_VARIANT: appVariant,
    EXPO_PUBLIC_APP_VARIANT: appVariant,
    ADS_MODE: flags.get('--ads'),
  });
  return { game, variant, purpose: flags.get('--avd') ?? 'smoke' };
}

/** Continuous Native Generation: android/ is regenerated from app.config.ts on every build. */
export const PREBUILD_ANDROID_ARGS = ['expo', 'prebuild', '--platform', 'android', '--clean'];

/** The emulator APK; bundleRelease (the Play AAB) belongs to release:android only. */
export const GRADLE_RELEASE_ARGS = ['assembleRelease', '--console=plain'];

/**
 * The emulator's ABI, the last part of the pinned system image (ANDROID_PINS.systemImage). An
 * emulator build compiles the native code for this ABI only, a quarter of the C++ work of all four;
 * the Play AAB (release:android) keeps every ABI.
 */
export const EMU_ABI = 'arm64-v8a';

/** gradlew arguments of the emulator build: the Release APK for the emulator's ABI only. */
export function gradleEmuArgs(): string[] {
  return ['-p', 'android', ...GRADLE_RELEASE_ARGS, `-PreactNativeArchitectures=${EMU_ABI}`];
}

export function apkPath(appDir: string): string {
  return join(appDir, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
}

/** adb arguments (after -s <serial>): replace an earlier install, keeping its data. */
export function installArgs(apk: string): string[] {
  return ['install', '-r', apk];
}

/** adb arguments (after -s <serial>): start the main activity and wait until it is drawn. */
export function launchArgs(packageName: string): string[] {
  return ['shell', 'am', 'start', '-W', '-n', `${packageName}/.MainActivity`];
}

export function screenshotPath(options: EmuBuildOptions): string {
  const { appVariant, adsMode } = options.variant;
  return join('reports', 'android', options.game, `smoke-${appVariant}-${adsMode}.png`);
}

/** Where expo-sqlite keeps save.db on the device (readable with adb root on a google_apis image). */
export function saveFolderOf(packageName: string): string {
  return `/data/data/${packageName}/files/SQLite`;
}

export const BOOT_POLL_MS = 1000;
export const BOOT_MAX_ATTEMPTS = 240;

/** The Android package is the iOS bundle id: io.applander.<game id without hyphens> (owner decision O4). */
export { appIdOf as packageNameOf } from '@e07/tooling/release/store-gate.ts';
