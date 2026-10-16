// Runs adb, the emulator and avdmanager for the Android parity path. Every call goes through here so
// the self-test can swap in fake tools (a path ending in .mjs runs with this Node), and every adb call
// names its device: adb.on(serial) puts "-s <serial>" first, and the only call without it is
// "adb devices". Several emulators and sessions share this Mac (other projects' AVDs too), so the
// parity scripts touch only an AVD named e07-android-parity[-<key>], found by its name.
import { spawn, spawnSync } from 'node:child_process';
import { closeSync, existsSync, openSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { fail } from '../check-lib.mjs';

/** The only AVD names the parity scripts create, start or pin. */
export const PARITY_AVD = /^e07-android-parity(?:-[a-z0-9]+)*$/;

/** An emulator's adb serial (the parity scripts drive emulators only). */
export const EMULATOR_SERIAL = /^emulator-\d{4,5}$/;

function exec(tool, args, { input, binary = false, timeoutMs = 120000 } = {}) {
  const isScript = /\.m?js$/.test(tool);
  const result = spawnSync(isScript ? process.execPath : tool, isScript ? [tool, ...args] : args, {
    encoding: binary ? 'buffer' : 'utf8',
    env: process.env,
    timeout: timeoutMs,
    maxBuffer: 128 * 1024 * 1024,
    input,
  });
  if (result.error?.code === 'ENOENT') return { status: 127, stdout: binary ? Buffer.alloc(0) : '', stderr: `${tool}: not found` };
  const stderr = Buffer.isBuffer(result.stderr) ? result.stderr.toString('utf8') : (result.stderr ?? '');
  return { status: result.status ?? (result.error ? 1 : 0), stdout: result.stdout ?? (binary ? Buffer.alloc(0) : ''), stderr: `${stderr}${result.error && result.error.code !== 'ENOENT' ? String(result.error.message) : ''}` };
}

/** The Android SDK: --sdk, $ANDROID_HOME, $ANDROID_SDK_ROOT, then Android Studio's default. */
export function sdkRootOf(option) {
  return option || process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || join(homedir(), 'Library', 'Android', 'sdk');
}

/** Where AVDs live: --avd-home, $ANDROID_AVD_HOME, then ~/.android/avd. */
export function avdHomeOf(option) {
  return option || process.env.ANDROID_AVD_HOME || join(homedir(), '.android', 'avd');
}

/** The SDK folder of a system image package: system-images;android-35;google_apis;arm64-v8a. */
export function systemImageDir(sdkRoot, pkg) {
  return join(sdkRoot, ...pkg.split(';'));
}

/** Quote one word for the device's shell (adb shell joins its arguments into one command line). */
export function shellQuote(word) {
  const text = String(word);
  return /^[A-Za-z0-9_./:=-]+$/.test(text) ? text : `'${text.replace(/'/g, "'\\''")}'`;
}

/**
 * The adb runner. adb('devices') is the one call without a device; every other call goes through
 * adb.on(serial)(...args), which puts -s <serial> first; .buffer() keeps binary stdout (screencap).
 */
export function makeAdb({ adb, sdk } = {}) {
  const tool = adb || process.env.PARITY_ADB || join(sdkRootOf(sdk), 'platform-tools', 'adb');
  const devices = () => exec(tool, ['devices']);
  const on = (serial) => {
    if (!EMULATOR_SERIAL.test(String(serial ?? ''))) fail(`"${serial}" is not an emulator serial`, 'Pass the serial of this session\'s own parity emulator (setup-parity-emu.mjs prints it, e.g. emulator-5554).');
    const call = (...args) => exec(tool, ['-s', serial, ...args]);
    call.buffer = (...args) => exec(tool, ['-s', serial, ...args], { binary: true });
    call.shell = (...words) => exec(tool, ['-s', serial, 'shell', words.map(shellQuote).join(' ')]);
    call.serial = serial;
    return call;
  };
  return { tool, devices, on };
}

/** avdmanager: list and create (create answers "no" to the custom hardware profile question). */
export function makeAvdmanager({ avdmanager, sdk } = {}) {
  const tool = avdmanager || process.env.PARITY_AVDMANAGER || join(sdkRootOf(sdk), 'cmdline-tools', 'latest', 'bin', 'avdmanager');
  return {
    tool,
    names: () => {
      const r = exec(tool, ['list', 'avd', '-c']);
      if (r.status !== 0) fail(`avdmanager list avd failed (${r.status}): ${(r.stderr || r.stdout).trim().split('\n')[0]}`, 'Install the Android command-line tools (android-emulator-build, toolchain) and set ANDROID_HOME; installing is the owner\'s step.');
      return r.stdout.split('\n').map((line) => line.trim()).filter(Boolean);
    },
    create: (name, pkg, baseDevice) => exec(tool, ['create', 'avd', '--name', name, '--package', pkg, '--device', baseDevice], { input: 'no\n' }),
  };
}

/** The emulator binary: started detached, its output in a log file, so it outlives this script. */
export function makeEmulator({ emulator, sdk } = {}) {
  const tool = emulator || process.env.PARITY_EMULATOR || join(sdkRootOf(sdk), 'emulator', 'emulator');
  return {
    tool,
    start: (name, port, logPath) => {
      const isScript = /\.m?js$/.test(tool);
      const args = ['-avd', name, '-port', String(port), '-no-snapshot', '-no-boot-anim', '-no-audio', '-no-window'];
      const fd = openSync(logPath, 'a');
      const child = spawn(isScript ? process.execPath : tool, isScript ? [tool, ...args] : args, { detached: true, stdio: ['ignore', fd, fd], env: process.env });
      child.unref();
      closeSync(fd);
      return args;
    },
  };
}

/**
 * The running emulators: [{ serial, state, avd }]. "adb devices" lists each as emulator-<port>; the
 * AVD behind a serial is asked with "adb -s <serial> emu avd name" (its first line).
 */
export function runningEmulators(adb) {
  const r = adb.devices();
  if (r.status !== 0) fail(`adb devices failed (${r.status}): ${(r.stderr || r.stdout).trim().split('\n')[0]}`, 'Install the Android platform tools and set ANDROID_HOME; never restart the adb server (other sessions use it).');
  const out = [];
  for (const line of r.stdout.split('\n')) {
    const m = /^(emulator-\d+)\s+(\S+)/.exec(line.trim());
    if (!m) continue;
    const name = adb.on(m[1])('emu', 'avd', 'name');
    out.push({ serial: m[1], state: m[2], avd: name.status === 0 ? name.stdout.split('\n')[0].trim() : null });
  }
  return out;
}

/** The first free even console port from 5554 (adb takes the odd port above it). */
export function freeConsolePort(running) {
  const used = new Set(running.map((e) => Number(e.serial.split('-')[1])));
  for (let port = 5554; port <= 5682; port += 2) if (!used.has(port)) return port;
  return fail('no free emulator console port from 5554 to 5682', 'Shut down your own e07-android-* emulators you no longer need (adb -s <serial> emu kill).');
}

/** An AVD's config.ini as { key: value }, or null when the AVD folder has none. */
export function readAvdConfig(avdHome, name) {
  const path = join(avdHome, `${name}.avd`, 'config.ini');
  if (!existsSync(path)) return null;
  const config = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = /^\s*([^#=\s][^=]*?)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) config[m[1]] = m[2];
  }
  return { path, config };
}

/** The demo-mode commands (android-emulator-build's demoModeCommands), as adb shell words. */
export function demoModeCommands(device) {
  return [
    ['settings', 'put', 'global', 'sysui_demo_allowed', '1'],
    ['am', 'broadcast', '-a', 'com.android.systemui.demo', '-e', 'command', 'enter'],
    ...(device.demoMode ?? []).map(([command, ...extras]) => ['am', 'broadcast', '-a', 'com.android.systemui.demo', '-e', 'command', command, ...extras]),
  ];
}
