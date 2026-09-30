// packages/tooling/src/ios/toolchain.test.ts
import { assertXcodeVersion, pickXcode, toolEnv, XCODE_VERSION } from './toolchain.ts';

const INSTALLED = [
  { appPath: '/Applications/Xcode.app', version: '27.0' },
  { appPath: '/Applications/Xcode-26.6.0.app', version: '26.6' },
];

describe('pickXcode', () => {
  it('picks the app whose version matches, not the one named Xcode.app', () => {
    expect(pickXcode(INSTALLED, '26.6').appPath).toBe('/Applications/Xcode-26.6.0.app');
  });

  it('refuses a version that is not installed and names what was found', () => {
    expect(() => pickXcode(INSTALLED, '26.7')).toThrow('found: /Applications/Xcode.app (27.0)');
  });

  it('refuses when no Xcode is installed at all', () => {
    expect(() => pickXcode([], XCODE_VERSION)).toThrow('found: none');
  });
});

describe('assertXcodeVersion', () => {
  it('accepts the pinned first line', () => {
    expect(() => {
      assertXcodeVersion('Xcode 26.6\nBuild version 17F113\n', '26.6');
    }).not.toThrow();
  });

  it('rejects another Xcode', () => {
    expect(() => {
      assertXcodeVersion('Xcode 27.0\nBuild version 27A266a\n', '26.6');
    }).toThrow('expected "Xcode 26.6"');
  });
});

describe('toolEnv', () => {
  it('sets DEVELOPER_DIR, no telemetry and no prompts on top of the base env', () => {
    const env = toolEnv({ PATH: '/usr/bin' }, '/Applications/Xcode-26.6.0.app/Contents/Developer');
    expect(env).toStrictEqual({
      PATH: '/usr/bin',
      DEVELOPER_DIR: '/Applications/Xcode-26.6.0.app/Contents/Developer',
      EXPO_NO_TELEMETRY: '1',
      CI: '1',
    });
  });
});
