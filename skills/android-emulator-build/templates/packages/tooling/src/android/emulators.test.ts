// packages/tooling/src/android/emulators.test.ts
import {
  adbArgs,
  avdName,
  createAvdArgs,
  deleteOwnAvdArgs,
  demoModeCommands,
  emulatorArgs,
  freeConsolePort,
  isBootCompleted,
  parseAdbDevices,
  serialOf,
} from './emulators.ts';
import { ANDROID_PINS } from './toolchain.ts';

const DEVICES = [
  'List of devices attached',
  'emulator-5554\tdevice',
  'emulator-5556\toffline',
  'R58M123ABC\tdevice',
  '',
].join('\n');

describe('avdName', () => {
  it('prefixes the purpose', () => {
    expect(avdName('smoke')).toBe('e07-android-smoke');
  });

  it('rejects a purpose that is not kebab-case', () => {
    expect(() => avdName('Pixel 8')).toThrow('must be kebab-case');
  });
});

describe('createAvdArgs', () => {
  it('creates an e07-android AVD on the pinned google_apis image, never overwriting one', () => {
    expect(createAvdArgs('smoke', 'pixel_8')).toStrictEqual([
      'create',
      'avd',
      '--name',
      'e07-android-smoke',
      '--package',
      ANDROID_PINS.systemImage,
      '--device',
      'pixel_8',
    ]);
  });
});

describe('parseAdbDevices', () => {
  it('reads every serial and its state', () => {
    expect(parseAdbDevices(DEVICES)).toStrictEqual([
      { serial: 'emulator-5554', state: 'device' },
      { serial: 'emulator-5556', state: 'offline' },
      { serial: 'R58M123ABC', state: 'device' },
    ]);
  });
});

describe('freeConsolePort', () => {
  it('skips the console ports another emulator already holds', () => {
    expect(freeConsolePort(parseAdbDevices(DEVICES))).toBe(5558);
  });

  it('starts at 5554 when no emulator runs', () => {
    expect(freeConsolePort([])).toBe(5554);
  });

  it('refuses when every console port is taken', () => {
    const all = Array.from({ length: 64 }, (_, index) => ({
      serial: serialOf(5554 + 2 * index),
      state: 'device',
    }));
    expect(() => freeConsolePort(all)).toThrow('no free emulator console port');
  });
});

describe('emulatorArgs', () => {
  it('starts the AVD on its own port, cold, without the boot animation or a window', () => {
    expect(emulatorArgs('e07-android-smoke', 5558)).toStrictEqual([
      '-avd',
      'e07-android-smoke',
      '-port',
      '5558',
      '-no-snapshot',
      '-no-boot-anim',
      '-no-audio',
      '-no-window',
    ]);
  });

  it("refuses another project's AVD", () => {
    expect(() => emulatorArgs('Pixel_8a_API_35', 5554)).toThrow('not an e07-android-* AVD');
  });
});

describe('adbArgs', () => {
  it('names the serial before every command', () => {
    expect(adbArgs('emulator-5558', ['shell', 'getprop', 'sys.boot_completed'])).toStrictEqual([
      '-s',
      'emulator-5558',
      'shell',
      'getprop',
      'sys.boot_completed',
    ]);
  });

  it('refuses kill-server, which would stop every other session on this Mac', () => {
    expect(() => adbArgs('emulator-5558', ['kill-server'])).toThrow('kill-server');
  });
});

describe('isBootCompleted', () => {
  it('is true only when sys.boot_completed is 1', () => {
    expect(isBootCompleted('1\n')).toBe(true);
    expect(isBootCompleted('\n')).toBe(false);
  });
});

describe('deleteOwnAvdArgs', () => {
  it('deletes an AVD this tooling created', () => {
    expect(deleteOwnAvdArgs('e07-android-kill-test')).toStrictEqual([
      'delete',
      'avd',
      '--name',
      'e07-android-kill-test',
    ]);
  });

  it('refuses any other AVD', () => {
    expect(() => deleteOwnAvdArgs('MindForge_Android_390x844')).toThrow('refusing to delete');
  });
});

describe('demoModeCommands', () => {
  it('pins the status bar clock to 9:41', () => {
    expect(demoModeCommands()).toContainEqual([
      'shell',
      'am',
      'broadcast',
      '-a',
      'com.android.systemui.demo',
      '-e',
      'command',
      'clock',
      '-e',
      'hhmm',
      '0941',
    ]);
  });
});
