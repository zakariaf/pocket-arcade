// packages/shell/src/app/read-version-text.ts
// The version line of S11's footer, S11b's chip and the support mail: the marketing version
// (readAppVersion, expo.version) and the native build number (withShell writes one number as
// ios.buildNumber and android.versionCode; each platform reads its own), both from expo-constants.
// expo-application is not in the dependency set. A parity capture (test builds) shows the design
// fixture's build number instead, so the text matches the reference.
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { readAppVersion } from '@e07/shell/app/read-game-extra.ts';
import { TEST_ONLY } from '@e07/shell/app/test-only.ts';

/** The part of the embedded app config that carries the native build number. */
type NativeBuildConfig = {
  readonly ios?: { readonly buildNumber?: string };
  readonly android?: { readonly versionCode?: number };
};

/** "1.0.0 (8)"; just "1.0.0" when the build number is unknown. */
export function versionTextOf(version: string, buildNumber: string | undefined): string {
  return buildNumber === undefined ? version : `${version} (${buildNumber})`;
}

/** iOS's buildNumber, or Android's versionCode on Android; undefined when the config lacks it. */
export function buildNumberOf(
  config: NativeBuildConfig | null | undefined,
  os: string,
): string | undefined {
  if (os !== 'android') return config?.ios?.buildNumber;
  const versionCode = config?.android?.versionCode;
  return versionCode === undefined ? undefined : String(versionCode);
}

export function readVersionText(): string {
  const buildNumber =
    TEST_ONLY?.parityBuildNumber() ?? buildNumberOf(Constants.expoConfig, Platform.OS);
  return versionTextOf(readAppVersion(), buildNumber);
}
