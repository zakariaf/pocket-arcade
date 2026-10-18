// android-emu.mjs: the Android emulator facts and pure helpers the device scripts share. A helper, not
// an entry point. Shared by toybox-visual-parity (setup-parity-emu, capture-app: lib/android.mjs) and
// save-persistence-and-migrations (kill-test, inspect-save: lib/android-device.mjs); each keeps its
// own adb runner.
//
// The system image is pinned here once: google_apis on arm64, never google_apis_playstore, because a
// Play Store image refuses `adb root` (the kill test and save inspection need it). toybox-visual-parity's
// device profile (assets/device/android-phone.json "systemImage") names the same package, and its
// self-test pins that it does.
//
// Console ports: an emulator's -port option takes an even console port from 5554 to 5682 (adb takes
// the odd port above it), 65 ports in all, and the emulator's adb serial is emulator-<port>.
import { homedir } from 'node:os';
import { join } from 'node:path';

/** The pinned system image of every e07-android-* AVD. */
export const SYSTEM_IMAGE = 'system-images;android-35;google_apis;arm64-v8a';

/** The emulator's console port range: even ports from FIRST to LAST. */
export const FIRST_CONSOLE_PORT = 5554;
export const LAST_CONSOLE_PORT = 5682;

/** The SDK folder: the given one, else $ANDROID_HOME, else $ANDROID_SDK_ROOT, else Android Studio's default. */
export function androidSdkRoot(given, env = process.env) {
  return given || env.ANDROID_HOME || env.ANDROID_SDK_ROOT || join(homedir(), 'Library', 'Android', 'sdk');
}

/** `adb devices` output as [{ serial, state }]: the header and daemon lines ("* daemon ...") are skipped. */
export function adbDevices(devicesOutput) {
  const out = [];
  for (const raw of String(devicesOutput ?? '').split('\n')) {
    const line = raw.trim();
    if (line === '' || line.startsWith('List of devices') || line.startsWith('*')) continue;
    const match = /^(\S+)\s+(\S+)/.exec(line);
    if (match) out.push({ serial: match[1], state: match[2] });
  }
  return out;
}

/** Serials of the devices `adb devices` lists as ready (state "device"). */
export function readySerials(devicesOutput) {
  return adbDevices(devicesOutput)
    .filter((device) => device.state === 'device')
    .map((device) => device.serial);
}

/** The first even console port from 5554 that none of these serials (emulator-<port>) holds, or null. */
export function freeConsolePort(serials) {
  const taken = new Set(serials.map((serial) => Number(/^emulator-(\d+)$/.exec(serial)?.[1])));
  for (let port = FIRST_CONSOLE_PORT; port <= LAST_CONSOLE_PORT; port += 2) if (!taken.has(port)) return port;
  return null;
}

/**
 * The demo-mode commands (android-emulator-build's demoModeCommands), as the words after
 * adb -s <serial> shell: allow demo mode, enter it, then the device profile's demoMode commands
 * ([command, ...extras], e.g. ['clock', '-e', 'hhmm', '0941']).
 */
export function demoModeCommands(device) {
  return [
    ['settings', 'put', 'global', 'sysui_demo_allowed', '1'],
    ['am', 'broadcast', '-a', 'com.android.systemui.demo', '-e', 'command', 'enter'],
    ...(device.demoMode ?? []).map(([command, ...extras]) => ['am', 'broadcast', '-a', 'com.android.systemui.demo', '-e', 'command', command, ...extras]),
  ];
}

/** Synchronous sleep without a child process (an agent's own `sleep` may be blocked). */
export function sleepMs(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
