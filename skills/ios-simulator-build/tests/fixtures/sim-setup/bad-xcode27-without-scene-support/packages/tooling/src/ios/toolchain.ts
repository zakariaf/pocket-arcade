// packages/tooling/src/ios/toolchain.ts
// Selects Xcode by version (never through xcode-select) and builds the environment that every
// xcodebuild, xcrun, CocoaPods and Expo CLI child process runs with.
import { execFileSync } from 'node:child_process';
import { globSync } from 'node:fs';
import { join } from 'node:path';

/** The one Xcode this repo builds with. Changing it is a deliberate, reviewed commit. */
export const XCODE_VERSION = '27.0';
/** The simulator runtime that ships with XCODE_VERSION. */
export const IOS_RUNTIME = 'com.apple.CoreSimulator.SimRuntime.iOS-26-5';

export type XcodeCandidate = { readonly appPath: string; readonly version: string };
export type ToolEnv = Readonly<Record<string, string | undefined>>;

/** Picks the Xcode whose CFBundleShortVersionString equals `wanted` exactly. */
export function pickXcode(candidates: readonly XcodeCandidate[], wanted: string): XcodeCandidate {
  const match = candidates.find((candidate) => candidate.version === wanted);
  if (match === undefined) {
    const found = candidates.map((c) => `${c.appPath} (${c.version})`).join(', ');
    throw new Error(
      `Xcode ${wanted} is not installed (found: ${found === '' ? 'none' : found}). ` +
        `Owner step O4: install it as /Applications/Xcode-${wanted}.0.app and accept its licence.`,
    );
  }
  return match;
}

/** The first line of `xcodebuild -version` must be exactly "Xcode <wanted>". */
export function assertXcodeVersion(output: string, wanted: string): void {
  const firstLine = output.split('\n')[0]?.trim() ?? '';
  if (firstLine !== `Xcode ${wanted}`) {
    throw new Error(`xcodebuild -version printed "${firstLine}", expected "Xcode ${wanted}"`);
  }
}

export function developerDirOf(appPath: string): string {
  return join(appPath, 'Contents', 'Developer');
}

/** Selected Xcode, no Expo telemetry, no interactive prompts: the env for every child process. */
export function toolEnv(base: ToolEnv, developerDir: string): NodeJS.ProcessEnv {
  return { ...base, DEVELOPER_DIR: developerDir, EXPO_NO_TELEMETRY: '1', CI: '1' };
}

function readShortVersion(appPath: string): string {
  const plist = join(appPath, 'Contents', 'Info.plist');
  return execFileSync(
    '/usr/libexec/PlistBuddy',
    ['-c', 'Print :CFBundleShortVersionString', plist],
    { encoding: 'utf8' },
  ).trim();
}

/** Finds XCODE_VERSION among /Applications/Xcode*.app and proves it with `xcodebuild -version`. */
export function selectXcode(base: ToolEnv): NodeJS.ProcessEnv {
  const candidates = globSync('/Applications/Xcode*.app').map((appPath) => ({
    appPath,
    version: readShortVersion(appPath),
  }));
  const xcode = pickXcode(candidates, XCODE_VERSION);
  const env = toolEnv(base, developerDirOf(xcode.appPath));
  assertXcodeVersion(
    execFileSync('xcodebuild', ['-version'], { encoding: 'utf8', env }),
    XCODE_VERSION,
  );
  return env;
}
