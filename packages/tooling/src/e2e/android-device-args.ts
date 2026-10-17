// packages/tooling/src/e2e/android-device-args.ts
// The one way the Android e2e tooling points Maestro and adb at an emulator. Several sessions and
// emulators share this Mac's adb server, so every adb call starts with -s <serial> (adbArgs from
// android-emulator-build's emulators.ts), and every Maestro run starts with the global
// --device <serial> --driver-host-port <port> before the command: Maestro 2.10's Android driver
// forwards its own host port, 7001 unless told otherwise, so two runs on the default port meet.
// Only emulator-<port> serials of this Mac's emulators are accepted, never a USB device.
import { adbArgs, demoModeCommands } from '@e07/tooling/android/emulators.ts';

/** Where one Maestro run goes: this emulator, and the host port of this run's own driver. */
export type AndroidMaestroTarget = {
  /** emulator-<console port>, from startEmulator (never a USB device or an AVD name). */
  readonly serial: string;
  /** freeDriverPort() for each run, or the session's own --driver-port (never 7001). */
  readonly driverPort: number;
};

/** settings put system font_scale: 2.0 is the 200 % text of the large-text step (spec 8.11). */
export const LARGE_FONT_SCALE = '2.0';
export const DEFAULT_FONT_SCALE = '1.0';

const SERIAL = /^emulator-\d{4,5}$/;
const MIN_PORT = 1024;
const MAX_PORT = 65_535;
/** Maestro's default Android driver host port: the one every other run on this Mac also gets. */
const DEFAULT_DRIVER_PORT = 7001;

function assertEmulatorSerial(serial: string): void {
  if (!SERIAL.test(serial)) {
    throw new Error(
      `adb: "${serial}" is not an emulator serial; pass the emulator-<port> serial startEmulator returned, never a USB device or an AVD name`,
    );
  }
}

function assertDriverPort(port: number): void {
  const isInRange = Number.isInteger(port) && port >= MIN_PORT && port <= MAX_PORT;
  if (!isInRange || port === DEFAULT_DRIVER_PORT) {
    throw new Error(
      `maestro: ${String(port)} is not a driver port of its own (${String(MIN_PORT)}-${String(MAX_PORT)}, never the default ${String(DEFAULT_DRIVER_PORT)})`,
    );
  }
}

/** The global arguments that go before the Maestro command: this emulator and this run's port. */
export function androidMaestroGlobalArgs(target: AndroidMaestroTarget): string[] {
  assertEmulatorSerial(target.serial);
  assertDriverPort(target.driverPort);
  return ['--device', target.serial, '--driver-host-port', String(target.driverPort)];
}

/** One line for the run's log: which emulator and driver port a Maestro command went to. */
export function androidMaestroRunLine(
  target: AndroidMaestroTarget,
  command: readonly string[],
): string {
  const shown = command.slice(0, 2).join(' ');
  return `maestro: device ${target.serial}, driver port ${String(target.driverPort)}: ${shown}`;
}

/** adb arguments for one emulator of this Mac: -s <serial> first, never kill-server. */
export function deviceAdbArgs(serial: string, args: readonly string[]): string[] {
  assertEmulatorSerial(serial);
  return adbArgs(serial, args);
}

const shell = (serial: string, ...args: readonly string[]): string[] =>
  deviceAdbArgs(serial, ['shell', ...args]);

/**
 * A debug link through a VIEW intent: Android asks nothing (no "Open in" alert as on iOS). adb
 * shell hands the words to the device's sh, so the link is single-quoted (its & would split it).
 */
export function deepLinkArgs(serial: string, link: string, packageName: string): string[] {
  if (link.includes("'")) throw new Error(`the link ${link} cannot be quoted for the device shell`);
  const intent = ['am', 'start', '-W', '-a', 'android.intent.action.VIEW'];
  return shell(serial, ...intent, '-d', `'${link}'`, packageName);
}

/** A measured cold launch: -S stops the app first, -W waits and prints LaunchState and TotalTime. */
export function coldLaunchArgs(serial: string, packageName: string): string[] {
  return shell(serial, 'am', 'start', '-W', '-S', '-n', `${packageName}/.MainActivity`);
}

export function forceStopArgs(serial: string, packageName: string): string[] {
  return shell(serial, 'am', 'force-stop', packageName);
}

/** The app's memory: total PSS in the App Summary (android-memory.ts reads it). */
export function meminfoArgs(serial: string, packageName: string): string[] {
  return shell(serial, 'dumpsys', 'meminfo', packageName);
}

/** `package:<name> uid:<uid>`: the uid whose sockets the sampler keeps. */
export function packageUidArgs(serial: string, packageName: string): string[] {
  return shell(serial, 'cmd', 'package', 'list', 'packages', '-U', packageName);
}

export function pidofArgs(serial: string, packageName: string): string[] {
  return shell(serial, 'pidof', packageName);
}

/** The four socket tables in one call, each after a "## <table>" marker (android-socket-sampler.ts). */
export function procNetArgs(serial: string): string[] {
  return shell(serial, 'for f in tcp tcp6 udp udp6; do echo "## $f"; cat /proc/net/$f; done');
}

/** Android's text size: 1.0, or 2.0 for the 200 % pass. */
export function fontScaleArgs(serial: string, scale: string): string[] {
  return shell(serial, 'settings', 'put', 'system', 'font_scale', scale);
}

/** Light or dark for theme=system captures. */
export function nightModeArgs(serial: string, theme: 'light' | 'dark'): string[] {
  return shell(serial, 'cmd', 'uimode', 'night', theme === 'dark' ? 'yes' : 'no');
}

const ANIMATION_SCALES = [
  'window_animation_scale',
  'transition_animation_scale',
  'animator_duration_scale',
] as const;

/** A still screen: the three animation scales at 0, then the demo-mode status bar at 9:41. */
export function stillScreenCommands(serial: string): string[][] {
  return [
    ...ANIMATION_SCALES.map((scale) => shell(serial, 'settings', 'put', 'global', scale, '0')),
    ...demoModeCommands().map((args) => deviceAdbArgs(serial, args)),
  ];
}
