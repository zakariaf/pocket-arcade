// packages/tooling/src/android/toolchain.test.ts
import {
  ANDROID_PINS,
  androidHomeOf,
  androidToolEnv,
  JDK_MAJOR,
  javaMajorOf,
  pickJavaHome,
  sdkProblems,
} from './toolchain.ts';

const JBR_17 =
  'openjdk version "17.0.11" 2024-04-16\nOpenJDK Runtime Environment (build 17.0.11+0)\n';
const JDK_21 = 'openjdk version "21.0.4" 2024-07-16\n';
const JDK_8 = 'openjdk version "1.8.0_402"\n';

describe('javaMajorOf', () => {
  it('reads the major version from java -version', () => {
    expect(javaMajorOf(JBR_17)).toBe(17);
    expect(javaMajorOf(JDK_21)).toBe(21);
  });

  it('reads a 1.x version as its minor number', () => {
    expect(javaMajorOf(JDK_8)).toBe(8);
  });

  it('returns null for text without a version', () => {
    expect(javaMajorOf('command not found')).toBeNull();
  });
});

describe('pickJavaHome', () => {
  it('picks the JDK 17 home, not the first one found', () => {
    const candidates = [
      { home: '/Library/Java/JavaVirtualMachines/jdk-21.jdk/Contents/Home', versionOutput: JDK_21 },
      {
        home: '/Applications/Android Studio.app/Contents/jbr/Contents/Home',
        versionOutput: JBR_17,
      },
    ];
    expect(pickJavaHome(candidates, JDK_MAJOR)).toBe(
      '/Applications/Android Studio.app/Contents/jbr/Contents/Home',
    );
  });

  it('refuses when no JDK 17 is installed and names what was found', () => {
    const candidates = [{ home: '/opt/jdk21', versionOutput: JDK_21 }];
    expect(() => pickJavaHome(candidates, JDK_MAJOR)).toThrow('found: /opt/jdk21 (21)');
  });

  it('refuses an empty list', () => {
    expect(() => pickJavaHome([], JDK_MAJOR)).toThrow('found: none');
  });
});

describe('androidHomeOf', () => {
  it('prefers ANDROID_HOME, then ANDROID_SDK_ROOT, then the Android Studio default', () => {
    expect(androidHomeOf({ ANDROID_HOME: '/sdk' }, '/home/me')).toBe('/sdk');
    expect(androidHomeOf({ ANDROID_SDK_ROOT: '/root-sdk' }, '/home/me')).toBe('/root-sdk');
    expect(androidHomeOf({}, '/home/me')).toBe('/home/me/Library/Android/sdk');
  });
});

describe('sdkProblems', () => {
  it('passes when every pinned SDK part exists', () => {
    expect(sdkProblems('/sdk', () => true)).toStrictEqual([]);
  });

  it('names the missing NDK with its sdkmanager package and says it is a download to ask for', () => {
    const problems = sdkProblems('/sdk', (path) => !path.includes('/ndk/'));
    expect(problems).toStrictEqual([
      `NDK ${ANDROID_PINS.ndk} is missing (/sdk/ndk/${ANDROID_PINS.ndk}): ask the owner, then sdkmanager "ndk;${ANDROID_PINS.ndk}" (a download)`,
    ]);
  });

  it('pins what Expo SDK 57 and React Native 0.86.3 build with', () => {
    expect(ANDROID_PINS).toStrictEqual({
      compileSdk: 36,
      targetSdk: 36,
      minSdk: 24,
      buildTools: '36.0.0',
      ndk: '27.1.12297006',
      cmake: '3.22.1',
      systemImage: 'system-images;android-35;google_apis;arm64-v8a',
    });
  });
});

describe('androidToolEnv', () => {
  it('sets JDK 17, the SDK, its tools on PATH, no telemetry and no prompts', () => {
    const env = androidToolEnv({ PATH: '/usr/bin' }, { javaHome: '/jbr', androidHome: '/sdk' });
    expect(env).toStrictEqual({
      PATH: '/jbr/bin:/sdk/platform-tools:/sdk/emulator:/usr/bin',
      JAVA_HOME: '/jbr',
      ANDROID_HOME: '/sdk',
      EXPO_NO_TELEMETRY: '1',
      CI: '1',
    });
  });
});
