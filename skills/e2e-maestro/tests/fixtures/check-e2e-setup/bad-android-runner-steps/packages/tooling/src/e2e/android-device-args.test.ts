// packages/tooling/src/e2e/android-device-args.test.ts
import fc from 'fast-check';

import {
  androidMaestroGlobalArgs,
  androidMaestroRunLine,
  coldLaunchArgs,
  deepLinkArgs,
  deviceAdbArgs,
  fontScaleArgs,
  LARGE_FONT_SCALE,
  meminfoArgs,
  nightModeArgs,
  packageUidArgs,
  pidofArgs,
  procNetArgs,
  stillScreenCommands,
} from './android-device-args.ts';

const SERIAL = 'emulator-5554';
const PACKAGE = 'io.applander.linesiege';

/** Every adb argument list the e2e tooling builds for one emulator. */
function everyAdbCall(serial: string): string[][] {
  return [
    deepLinkArgs(serial, 'linesiege://debug/setup?lang=en&screen=home', PACKAGE),
    coldLaunchArgs(serial, PACKAGE),
    meminfoArgs(serial, PACKAGE),
    packageUidArgs(serial, PACKAGE),
    pidofArgs(serial, PACKAGE),
    procNetArgs(serial),
    fontScaleArgs(serial, LARGE_FONT_SCALE),
    nightModeArgs(serial, 'dark'),
    ...stillScreenCommands(serial),
  ];
}

describe('androidMaestroGlobalArgs', () => {
  it('names the emulator and a driver port of its own before the command', () => {
    const args = [...androidMaestroGlobalArgs({ serial: SERIAL, driverPort: 53_117 }), 'test'];
    expect(args).toStrictEqual(['--device', SERIAL, '--driver-host-port', '53117', 'test']);
  });

  it('refuses a USB device, "booted", an AVD name and an empty serial', () => {
    for (const serial of ['R58M123ABC', 'booted', 'e07-android-e2e-phone', '']) {
      expect(() => androidMaestroGlobalArgs({ serial, driverPort: 53_117 })).toThrow(
        'is not an emulator serial',
      );
    }
  });

  it('refuses a port outside 1024-65535, the default 7001 included', () => {
    for (const driverPort of [0, 80, 7001, 65_536, 7002.5]) {
      expect(() => androidMaestroGlobalArgs({ serial: SERIAL, driverPort })).toThrow(
        'is not a driver port',
      );
    }
  });

  it('keeps the serial and the port first for any emulator and port', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 5554, max: 5682 }),
        fc.integer({ min: 1024, max: 65_535 }).filter((port) => port !== 7001),
        (consolePort, driverPort) => {
          const serial = `emulator-${String(consolePort)}`;
          const args = androidMaestroGlobalArgs({ serial, driverPort });
          return args[1] === serial && args[3] === String(driverPort);
        },
      ),
    );
  });
});

describe('androidMaestroRunLine', () => {
  it('logs the emulator and the port of the run with its command', () => {
    const target = { serial: SERIAL, driverPort: 53_117 };
    expect(androidMaestroRunLine(target, ['test', 'a.yaml', '--format', 'JUNIT'])).toBe(
      'maestro: device emulator-5554, driver port 53117: test a.yaml',
    );
  });
});

describe('the adb calls', () => {
  it('puts the serial first in every call', () => {
    for (const args of everyAdbCall(SERIAL)) expect(args.slice(0, 2)).toStrictEqual(['-s', SERIAL]);
  });

  it('refuses a serial that is not an emulator of this Mac', () => {
    expect(() => deviceAdbArgs('R58M123ABC', ['shell', 'true'])).toThrow(
      'is not an emulator serial',
    );
  });

  it('refuses kill-server, which would stop the adb server other sessions share', () => {
    expect(() => deviceAdbArgs(SERIAL, ['kill-server'])).toThrow('never run it');
  });
});

describe('deepLinkArgs', () => {
  it('opens the debug link with a VIEW intent, quoted for the device shell (no "Open in" alert)', () => {
    expect(
      deepLinkArgs(SERIAL, 'linesiege://debug/setup?lang=en&screen=home', PACKAGE),
    ).toStrictEqual([
      ...['-s', SERIAL, 'shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW'],
      ...['-d', "'linesiege://debug/setup?lang=en&screen=home'", PACKAGE],
    ]);
  });

  it('refuses a link the device shell could not quote', () => {
    expect(() => deepLinkArgs(SERIAL, "linesiege://debug/setup?x='1'", PACKAGE)).toThrow(
      'cannot be quoted',
    );
  });
});

describe('coldLaunchArgs', () => {
  it('stops the app first and waits for the launch (am start -W -S)', () => {
    expect(coldLaunchArgs(SERIAL, PACKAGE)).toStrictEqual([
      ...['-s', SERIAL, 'shell', 'am', 'start', '-W', '-S'],
      ...['-n', `${PACKAGE}/.MainActivity`],
    ]);
  });
});

describe('the device settings of a run', () => {
  it('sets the 200 % font scale with settings put system font_scale 2.0', () => {
    expect(fontScaleArgs(SERIAL, LARGE_FONT_SCALE)).toStrictEqual([
      ...['-s', SERIAL, 'shell', 'settings', 'put', 'system', 'font_scale', '2.0'],
    ]);
  });

  it('turns the three animation scales off and pins the demo status bar at 9:41', () => {
    const commands = stillScreenCommands(SERIAL).map((args) => args.join(' '));
    for (const scale of [
      'window_animation_scale',
      'transition_animation_scale',
      'animator_duration_scale',
    ]) {
      expect(commands).toContain(`-s ${SERIAL} shell settings put global ${scale} 0`);
    }
    expect(commands.some((line) => line.includes('-e hhmm 0941'))).toBe(true);
  });

  it('switches dark mode with cmd uimode night', () => {
    expect(nightModeArgs(SERIAL, 'light')).toStrictEqual([
      ...['-s', SERIAL, 'shell', 'cmd', 'uimode', 'night', 'no'],
    ]);
  });

  it('reads the sockets of all four /proc/net tables in one call, each after its marker', () => {
    const args = procNetArgs(SERIAL);
    expect(args.slice(0, 3)).toStrictEqual(['-s', SERIAL, 'shell']);
    expect(args[3]).toBe('for f in tcp tcp6 udp udp6; do echo "## $f"; cat /proc/net/$f; done');
  });
});
