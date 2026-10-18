// packages/tooling/src/android/emulators.test.ts
import {
  adbArgs,
  avdName,
  createAvdArgs,
  deleteOwnAvdArgs,
  demoModeCommands,
  emulatorArgs,
  freeConsolePort,
  isAvdPurpose,
  isBootCompleted,
  parseAdbDevices,
  perfLogReaderOf,
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

describe('isAvdPurpose', () => {
  it('accepts a kebab-case purpose and nothing else (the --avd option of every CLI)', () => {
    expect(['smoke', 'e2e-phone', 'shots-2'].map(isAvdPurpose)).toStrictEqual([true, true, true]);
    expect(['Pixel 8', '-smoke', 'e2e--phone', 'smoke-', ''].map(isAvdPurpose)).toStrictEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
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

describe('perfLogReaderOf (save.db pulled with adb root)', () => {
  type Calls = string[];
  const opsOf = (calls: Calls, overrides: Partial<Record<'root' | 'pull', () => void>> = {}) => ({
    root: overrides.root ?? (() => calls.push('root')),
    pull: overrides.pull ?? (() => calls.push('pull')),
    payload: () => {
      calls.push('payload');
      return '[{"kind":"cold-start"}]';
    },
  });
  const refuse = (): void => {
    throw new Error('adbd cannot run as root in production builds');
  };

  it('becomes root once, then pulls the save again for every read', () => {
    const calls: Calls = [];
    const read = perfLogReaderOf(opsOf(calls), 'null');
    expect([read(), read()]).toStrictEqual(['[{"kind":"cold-start"}]', '[{"kind":"cold-start"}]']);
    expect(calls).toStrictEqual(['root', 'pull', 'payload', 'pull', 'payload']);
  });

  it('reads null while the save cannot be pulled yet', () => {
    const calls: Calls = [];
    expect(perfLogReaderOf(opsOf(calls, { pull: refuse }), 'null')()).toBeNull();
    expect(calls).toStrictEqual(['root']);
  });

  it('reads null without pulling when root failed and the caller can do without the log (the build)', () => {
    const calls: Calls = [];
    expect(perfLogReaderOf(opsOf(calls, { root: refuse }), 'null')()).toBeNull();
    expect(calls).toStrictEqual([]);
  });

  it('throws at once when root failed and the caller needs the log (e2e:android)', () => {
    expect(() => perfLogReaderOf(opsOf([], { root: refuse }), 'throw')).toThrow(
      'adb root failed (adbd cannot run as root in production builds): the perf log needs the google_apis image of an e07-android-* AVD',
    );
  });
});
