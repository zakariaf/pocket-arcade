// packages/tooling/src/android/emulators.ts
// Dedicated emulators named e07-android-<purpose> on the pinned google_apis image (adb root works
// there, never on a Play Store image). Each runs on a console port of its own and is targeted as
// emulator-<port> with adb -s in every call. Only e07-android-* AVDs are ever started or deleted:
// other projects' AVDs and other sessions' emulators share this Mac.
import { ANDROID_PINS } from '@e07/tooling/android/toolchain.ts';

export const AVD_PREFIX = 'e07-android-';
/** The phone profile of smoke builds (avdmanager list device -c). */
export const DEFAULT_DEVICE = 'pixel_8';

/** Emulator console ports are even numbers from 5554; adb uses the odd port above each. */
const FIRST_CONSOLE_PORT = 5554;
const CONSOLE_PORT_COUNT = 64;

export type AdbDevice = { readonly serial: string; readonly state: string };

const PURPOSE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** A kebab-case AVD purpose (`smoke`, `e2e-phone`): what every --avd option takes. */
export function isAvdPurpose(purpose: string): boolean {
  return PURPOSE.test(purpose);
}

/** `smoke` -> `e07-android-smoke`. Every AVD this tooling touches carries the prefix. */
export function avdName(purpose: string): string {
  if (!isAvdPurpose(purpose)) {
    throw new Error(`AVD purpose "${purpose}" must be kebab-case, for example "smoke"`);
  }
  return `${AVD_PREFIX}${purpose}`;
}

function assertOwnAvd(name: string, action: string): void {
  if (!name.startsWith(AVD_PREFIX)) {
    throw new Error(`refusing to ${action} "${name}": not an ${AVD_PREFIX}* AVD`);
  }
}

/** avdmanager arguments: the pinned google_apis image; no --force, so an AVD is never overwritten. */
export function createAvdArgs(purpose: string, device: string): string[] {
  return [
    ...['create', 'avd', '--name', avdName(purpose)],
    ...['--package', ANDROID_PINS.systemImage, '--device', device],
  ];
}

/** `adb devices` output -> every serial with its state (device, offline, unauthorized). */
export function parseAdbDevices(output: string): AdbDevice[] {
  return output
    .split('\n')
    .map((line) => /^(\S+)\t(\S+)$/.exec(line.trim()))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => ({ serial: match[1] ?? '', state: match[2] ?? '' }));
}

export function serialOf(port: number): string {
  return `emulator-${String(port)}`;
}

/** The first even console port from 5554 that no running emulator holds. */
export function freeConsolePort(devices: readonly AdbDevice[]): number {
  const taken = new Set(devices.map((device) => device.serial));
  for (let index = 0; index < CONSOLE_PORT_COUNT; index += 1) {
    const port = FIRST_CONSOLE_PORT + 2 * index;
    if (!taken.has(serialOf(port))) return port;
  }
  throw new Error('no free emulator console port from 5554 to 5680: shut down your own emulators');
}

/** A cold start on its own port, no boot animation, no audio, no window (screencap still works). */
export function emulatorArgs(name: string, port: number): string[] {
  assertOwnAvd(name, 'start');
  return [
    ...['-avd', name, '-port', String(port)],
    ...['-no-snapshot', '-no-boot-anim', '-no-audio', '-no-window'],
  ];
}

/** adb arguments with the serial first; kill-server would cut off every other session's devices. */
export function adbArgs(serial: string, args: readonly string[]): string[] {
  if (args.includes('kill-server')) {
    throw new Error('kill-server stops every emulator connection on this Mac; never run it');
  }
  return ['-s', serial, ...args];
}

/** `adb -s <serial> shell getprop sys.boot_completed` prints 1 once Android has booted. */
export function isBootCompleted(output: string): boolean {
  return output.trim() === '1';
}

/** avdmanager arguments to delete an AVD this tooling created; refuses any other name. */
export function deleteOwnAvdArgs(name: string): string[] {
  assertOwnAvd(name, 'delete');
  return ['delete', 'avd', '--name', name];
}

function demo(command: string, ...extras: readonly string[]): string[] {
  return [
    ...['shell', 'am', 'broadcast', '-a', 'com.android.systemui.demo'],
    ...['-e', 'command', command, ...extras],
  ];
}

/** adb argument lists (after -s <serial>) for a still status bar: 9:41, full battery, no icons. */
export function demoModeCommands(): string[][] {
  return [
    ['shell', 'settings', 'put', 'global', 'sysui_demo_allowed', '1'],
    demo('enter'),
    demo('clock', '-e', 'hhmm', '0941'),
    demo('battery', '-e', 'level', '100', '-e', 'plugged', 'false'),
    demo('network', '-e', 'wifi', 'show', '-e', 'level', '4', '-e', 'mobile', 'hide'),
    demo('notifications', '-e', 'visible', 'false'),
  ];
}

/** The device side of the perf-log reader (emulator-device.ts gives it adb). */
export type PerfLogOps = {
  /** Root, then wait for the device again: throws on a Play Store image. */
  readonly root: () => void;
  /** Pulls the app's SQLite folder: throws until the app has written it. */
  readonly pull: () => void;
  /** The perf_log payload of the pulled save.db, or null. */
  readonly payload: () => string | null;
};

/**
 * The test build's perf log, read again on every call: null until it can be read. Root comes first
 * and once; when it fails, `whenNoRoot` decides: 'null' (build:android:emu waits for a still screen
 * instead) or 'throw' (e2e:android cannot measure without the log).
 */
export function perfLogReaderOf(
  ops: PerfLogOps,
  whenNoRoot: 'null' | 'throw',
): () => string | null {
  try {
    ops.root();
  } catch (error: unknown) {
    if (whenNoRoot === 'throw') {
      const why = error instanceof Error ? error.message : String(error);
      throw new Error(
        `root on the emulator failed (${why}): the perf log needs the google_apis image of an e07-android-* AVD`,
      );
    }
    return () => null;
  }
  return () => {
    try {
      ops.pull();
      return ops.payload();
    } catch {
      return null; // not written yet, or unreadable: the next poll tries again
    }
  };
}
