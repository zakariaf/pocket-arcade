// packages/tooling/src/android/toolchain.ts
// Picks JDK 17 (Android Studio's JBR) and the Android SDK, checks the pinned SDK parts, and builds
// the environment every Gradle, adb, emulator and Expo CLI child process runs with. Nothing global
// changes: JAVA_HOME and ANDROID_HOME are set per process, never through /usr/libexec/java_home -s.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** Gradle 9 with AGP 8.12 (React Native 0.86.3) runs on JDK 17. */
export const JDK_MAJOR = 17;

/**
 * What Expo SDK 57 and React Native 0.86.3 build with (react-native/gradle/libs.versions.toml, the
 * version catalog Expo's root-project plugin reads), and the emulator image this repo checks on.
 * Changing a pin is a deliberate, reviewed commit (expo-sdk-upgrade moves them together).
 */
export const ANDROID_PINS = {
  compileSdk: 36,
  targetSdk: 36,
  minSdk: 24,
  buildTools: '36.0.0',
  ndk: '27.1.12297006',
  cmake: '3.22.1',
  systemImage: 'system-images;android-35;google_apis_playstore;arm64-v8a',
} as const;

/** Android Studio's bundled JDK on macOS, the default JDK 17 of this Mac. */
export const STUDIO_JBR = '/Applications/Android Studio.app/Contents/jbr/Contents/Home';

export type ToolEnv = Readonly<Record<string, string | undefined>>;
export type JavaCandidate = { readonly home: string; readonly versionOutput: string };

/** `openjdk version "17.0.11"` -> 17, `"1.8.0_402"` -> 8; null when no version is printed. */
export function javaMajorOf(output: string): number | null {
  const match = /version "(\d+)(?:\.(\d+))?/.exec(output);
  if (match === null) return null;
  const first = Number(match[1]);
  return first === 1 && match[2] !== undefined ? Number(match[2]) : first;
}

/** The home of the JDK whose major version is `wanted`; throws naming every JDK found. */
export function pickJavaHome(candidates: readonly JavaCandidate[], wanted: number): string {
  const match = candidates.find((candidate) => javaMajorOf(candidate.versionOutput) === wanted);
  if (match !== undefined) return match.home;
  const found = candidates
    .map((candidate) => `${candidate.home} (${String(javaMajorOf(candidate.versionOutput))})`)
    .join(', ');
  throw new Error(
    `JDK ${String(wanted)} is not installed (found: ${found === '' ? 'none' : found}). ` +
      'Owner step: install Android Studio, whose bundled JBR is JDK 17.',
  );
}

/** ANDROID_HOME, else ANDROID_SDK_ROOT, else Android Studio's default SDK folder. */
export function androidHomeOf(env: ToolEnv, homeDir: string): string {
  return (
    env['ANDROID_HOME'] ?? env['ANDROID_SDK_ROOT'] ?? join(homeDir, 'Library', 'Android', 'sdk')
  );
}

const PLATFORM_TOOLS = 'platform-tools';

/** Each SDK part the build needs: its name, its folder under the SDK and its sdkmanager package. */
const SDK_PARTS: readonly (readonly [string, string, string])[] = [
  ['platforms', `android-${String(ANDROID_PINS.compileSdk)}`, 'platform'],
  ['build-tools', ANDROID_PINS.buildTools, 'build-tools'],
  ['ndk', ANDROID_PINS.ndk, 'NDK'],
  ['cmake', ANDROID_PINS.cmake, 'CMake'],
];

/** One line per pinned SDK part the build needs that is missing. Downloads are asked for first. */
export function sdkProblems(androidHome: string, exists: (path: string) => boolean): string[] {
  const parts = [
    ...SDK_PARTS.map(([folder, version, name]) => ({
      name: `${name} ${version}`,
      path: join(androidHome, folder, version),
      sdkPackage: `${folder};${version}`,
    })),
    {
      name: `${PLATFORM_TOOLS} (adb)`,
      path: join(androidHome, PLATFORM_TOOLS, 'adb'),
      sdkPackage: PLATFORM_TOOLS,
    },
  ];
  return parts
    .filter((part) => !exists(part.path))
    .map(
      (part) =>
        `${part.name} is missing (${part.path}): ask the owner, then sdkmanager "${part.sdkPackage}" (a download)`,
    );
}

/** JDK 17, the SDK and its tools first on PATH, no Expo telemetry, no prompts. */
export function androidToolEnv(
  base: ToolEnv,
  homes: { readonly javaHome: string; readonly androidHome: string },
): NodeJS.ProcessEnv {
  const { javaHome, androidHome } = homes;
  const path = [
    join(javaHome, 'bin'),
    join(androidHome, PLATFORM_TOOLS),
    join(androidHome, 'emulator'),
    base['PATH'] ?? '',
  ].join(':');
  return {
    ...base,
    PATH: path,
    JAVA_HOME: javaHome,
    ANDROID_HOME: androidHome,
    EXPO_NO_TELEMETRY: '1',
    CI: '1',
  };
}

function javaVersionOf(home: string): string {
  const result = spawnSync(join(home, 'bin', 'java'), ['-version'], { encoding: 'utf8' });
  return `${result.stderr}${result.stdout}`;
}

/** Finds JDK 17 (JAVA_HOME, then Android Studio's JBR) and the SDK, proves the pins, returns the env. */
export function selectAndroidToolchain(base: ToolEnv): NodeJS.ProcessEnv {
  const homes = [base['JAVA_HOME'], STUDIO_JBR].filter(
    (home): home is string => home !== undefined && existsSync(join(home, 'bin', 'java')),
  );
  const javaHome = pickJavaHome(
    homes.map((home) => ({ home, versionOutput: javaVersionOf(home) })),
    JDK_MAJOR,
  );
  const androidHome = androidHomeOf(base, homedir());
  const problems = sdkProblems(androidHome, existsSync);
  if (problems.length > 0) {
    throw new Error(`the Android SDK is not ready:\n  ${problems.join('\n  ')}`);
  }
  return androidToolEnv(base, { javaHome, androidHome });
}
