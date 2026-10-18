// packages/tooling/src/build/emu-build-plan.test.ts
import { ANDROID_PINS } from '@e07/tooling/android/toolchain.ts';

import {
  apkPath,
  EMU_ABI,
  EMU_BUILD_USAGE,
  gradleEmuArgs,
  GRADLE_RELEASE_ARGS,
  installArgs,
  isHelpRequest,
  launchArgs,
  packageNameOf,
  parseEmuBuildArgs,
  PREBUILD_ANDROID_ARGS,
  saveFolderOf,
  screenshotPath,
  variantEnv,
} from './emu-build-plan.ts';

describe('parseEmuBuildArgs', () => {
  it('defaults to a test build with test ads on e07-android-smoke', () => {
    const options = parseEmuBuildArgs(['--app', 'line-siege']);
    expect(options).toStrictEqual({
      game: 'line-siege',
      variant: { appVariant: 'test', adsMode: 'test' },
      purpose: 'smoke',
    });
  });

  it('takes the variant, the ads mode and the AVD purpose', () => {
    const options = parseEmuBuildArgs([
      ...['--app', 'line-siege', '--variant', 'store', '--ads', 'off', '--avd', 'variant-proof'],
    ]);
    expect(options.variant).toStrictEqual({ appVariant: 'store', adsMode: 'off' });
    expect(options.purpose).toBe('variant-proof');
  });

  it('refuses a store build with test ads, as app.config.ts does', () => {
    expect(() =>
      parseEmuBuildArgs(['--app', 'line-siege', '--variant', 'store', '--ads', 'test']),
    ).toThrow('store');
  });

  it('refuses a missing or invalid game id and prints the usage', () => {
    expect(() => parseEmuBuildArgs(['--variant', 'test'])).toThrow(EMU_BUILD_USAGE);
    expect(() => parseEmuBuildArgs(['--app', 'Line_Siege'])).toThrow('--app <game-id>');
  });

  it('refuses an unknown flag', () => {
    expect(() => parseEmuBuildArgs(['--app', 'line-siege', '--sim', 'smoke'])).toThrow(
      'unexpected argument "--sim"',
    );
  });
});

describe('isHelpRequest', () => {
  it('is true for --help and -h anywhere', () => {
    expect(isHelpRequest(['--app', 'line-siege', '--help'])).toBe(true);
    expect(isHelpRequest(['-h'])).toBe(true);
    expect(isHelpRequest(['--app', 'line-siege'])).toBe(false);
  });
});

describe('variantEnv', () => {
  it('exports the three variables for the whole run', () => {
    expect(variantEnv({ appVariant: 'store', adsMode: 'off' })).toStrictEqual({
      APP_VARIANT: 'store',
      EXPO_PUBLIC_APP_VARIANT: 'store',
      ADS_MODE: 'off',
    });
  });
});

describe('the build commands', () => {
  it('prebuilds Android only, from clean', () => {
    expect(PREBUILD_ANDROID_ARGS).toStrictEqual([
      'expo',
      'prebuild',
      '--platform',
      'android',
      '--clean',
    ]);
  });

  it('assembles the Release APK, never the Play bundle', () => {
    expect(GRADLE_RELEASE_ARGS).toStrictEqual(['assembleRelease', '--console=plain']);
  });

  it("compiles only the pinned emulator image's ABI, arm64-v8a", () => {
    expect(EMU_ABI).toBe('arm64-v8a');
    expect(ANDROID_PINS.systemImage.endsWith(`;${EMU_ABI}`)).toBe(true);
    expect(gradleEmuArgs()).toStrictEqual([
      ...['-p', 'android', 'assembleRelease', '--console=plain'],
      '-PreactNativeArchitectures=arm64-v8a',
    ]);
  });

  it('finds the APK where Gradle writes it', () => {
    expect(apkPath('apps/line-siege')).toBe(
      'apps/line-siege/android/app/build/outputs/apk/release/app-release.apk',
    );
  });

  it('installs over an earlier install and launches the main activity, waiting for it', () => {
    expect(installArgs('app-release.apk')).toStrictEqual(['install', '-r', 'app-release.apk']);
    expect(launchArgs('io.applander.linesiege')).toStrictEqual([
      ...['shell', 'am', 'start', '-W', '-n', 'io.applander.linesiege/.MainActivity'],
    ]);
  });
});

describe('screenshotPath', () => {
  it('names the variant and the ads mode', () => {
    const options = parseEmuBuildArgs(['--app', 'line-siege', '--ads', 'off']);
    expect(screenshotPath(options)).toBe('reports/android/line-siege/smoke-test-off.png');
  });
});

describe('saveFolderOf', () => {
  it("is expo-sqlite's folder in the app's files directory", () => {
    expect(saveFolderOf('io.applander.linesiege')).toBe(
      '/data/data/io.applander.linesiege/files/SQLite',
    );
  });
});

describe('packageNameOf', () => {
  it('is io.applander.<game id without hyphens> (owner decision O4)', () => {
    expect(packageNameOf('line-siege')).toBe('io.applander.linesiege');
  });
});
