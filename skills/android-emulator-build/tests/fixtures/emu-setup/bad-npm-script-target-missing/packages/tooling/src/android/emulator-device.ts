// packages/tooling/src/android/emulator-device.ts
// device-only: covered by npm run build:android:emu on an e07-android-* emulator, then check-emu-app
// The side of build:android:emu that talks to the emulator: create the AVD once, start it on a free
// console port (or reuse it when it already runs), wait for sys.boot_completed, pin the status bar,
// and run adb with -s <serial> in every call. The pure parts live in emulators.ts and are tested.
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, openSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import {
  adbArgs,
  avdName,
  createAvdArgs,
  DEFAULT_DEVICE,
  demoModeCommands,
  emulatorArgs,
  freeConsolePort,
  isBootCompleted,
  parseAdbDevices,
  serialOf,
} from '@e07/tooling/android/emulators.ts';
import { BOOT_MAX_ATTEMPTS, BOOT_POLL_MS } from '@e07/tooling/build/emu-build-plan.ts';
import { sleepMs } from '@e07/tooling/ios/tool-step.ts';

export type Tools = {
  readonly adb: string;
  readonly emulator: string;
  readonly avdmanager: string;
};
export type Device = {
  readonly serial: string;
  readonly env: NodeJS.ProcessEnv;
  readonly tools: Tools;
};

export function toolsOf(env: NodeJS.ProcessEnv): Tools {
  const sdk = env['ANDROID_HOME'] ?? '';
  return {
    adb: join(sdk, 'platform-tools', 'adb'),
    emulator: join(sdk, 'emulator', 'emulator'),
    avdmanager: join(sdk, 'cmdline-tools', 'latest', 'bin', 'avdmanager'),
  };
}

export function adb(device: Device, args: readonly string[]): string {
  return execFileSync(device.tools.adb, adbArgs(device.serial, args), {
    encoding: 'utf8',
    env: device.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

/** The serial of e07-android-<purpose> when it already runs (adb emu avd name), else null. */
function runningSerialOf(tools: Tools, env: NodeJS.ProcessEnv, name: string): string | null {
  const devices = parseAdbDevices(execFileSync(tools.adb, ['devices'], { encoding: 'utf8', env }));
  for (const { serial } of devices.filter((device) => device.serial.startsWith('emulator-'))) {
    const answer = execFileSync(tools.adb, adbArgs(serial, ['emu', 'avd', 'name']), {
      encoding: 'utf8',
      env,
    });
    if (answer.split('\n')[0]?.trim() === name) return serial;
  }
  return null;
}

/** Creates the AVD once (avdmanager asks about a custom profile: answer no), then starts it. */
export function startEmulator(purpose: string, env: NodeJS.ProcessEnv, appDir: string): Device {
  const tools = toolsOf(env);
  const name = avdName(purpose);
  const avds = execFileSync(tools.emulator, ['-list-avds'], { encoding: 'utf8', env }).split('\n');
  if (!avds.map((line) => line.trim()).includes(name)) {
    execFileSync(tools.avdmanager, createAvdArgs(purpose, DEFAULT_DEVICE), {
      input: 'no\n',
      env,
    });
  }
  const running = runningSerialOf(tools, env, name);
  if (running !== null) return { serial: running, env, tools };
  const devices = parseAdbDevices(execFileSync(tools.adb, ['devices'], { encoding: 'utf8', env }));
  const port = freeConsolePort(devices);
  const log = join(appDir, 'build', 'logs', 'emulator.log');
  mkdirSync(dirname(log), { recursive: true });
  const out = openSync(log, 'w');
  spawn(tools.emulator, emulatorArgs(name, port), {
    env,
    detached: true,
    stdio: ['ignore', out, out],
  }).unref();
  console.log(`build:android:emu: started ${name} as ${serialOf(port)} (log ${log})`);
  return { serial: serialOf(port), env, tools };
}

function isBooted(device: Device): boolean {
  try {
    return isBootCompleted(adb(device, ['shell', 'getprop', 'sys.boot_completed']));
  } catch {
    return false; // not listed by adb yet
  }
}

/** Polls sys.boot_completed (adb fails until the device is listed), then pins the status bar. */
export function waitForBoot(device: Device): void {
  for (let attempt = 1; attempt <= BOOT_MAX_ATTEMPTS; attempt += 1) {
    sleepMs(BOOT_POLL_MS);
    if (isBooted(device)) {
      for (const command of demoModeCommands()) adb(device, command);
      return;
    }
  }
  throw new Error(
    `${device.serial} did not boot within ${String((BOOT_MAX_ATTEMPTS * BOOT_POLL_MS) / 1000)} s; see build/logs/emulator.log`,
  );
}

export function screencap(device: Device, out: string): Buffer {
  const png = execFileSync(
    device.tools.adb,
    adbArgs(device.serial, ['exec-out', 'screencap', '-p']),
    {
      env: device.env,
      maxBuffer: 64 << 20,
    },
  );
  writeFileSync(out, png);
  return png;
}
