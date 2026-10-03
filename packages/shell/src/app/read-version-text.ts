// packages/shell/src/app/read-version-text.ts
// The version line of S11's footer, S11b's chip and the support mail: the marketing version
// (readAppVersion, expo.version) and the native build number (ios.buildNumber from withShell),
// both from expo-constants. expo-application is not in the dependency set. A parity capture (test
// builds) shows the design fixture's build number instead, so the text matches the reference.
import Constants from 'expo-constants';

import { readAppVersion } from '@e07/shell/app/read-game-extra.ts';
import { TEST_ONLY } from '@e07/shell/app/test-only.ts';

/** "1.0.0 (8)"; just "1.0.0" when the build number is unknown. */
export function versionTextOf(version: string, buildNumber: string | undefined): string {
  return buildNumber === undefined ? version : `${version} (${buildNumber})`;
}

export function readVersionText(): string {
  const buildNumber = TEST_ONLY?.parityBuildNumber() ?? Constants.expoConfig?.ios?.buildNumber;
  return versionTextOf(readAppVersion(), buildNumber);
}
