// packages/tooling/src/ios/simulators.ts
// Dedicated simulators named e07-<purpose>: found or created once, then targeted by UDID.
// Only simulators with the e07- prefix are ever shut down or deleted (other agents share this Mac).
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { IOS_RUNTIME } from '@e07/tooling/ios/toolchain.ts';

export const SIMULATOR_PREFIX = 'e07-';
export const DEFAULT_DEVICE_TYPE = 'iPhone 17 Pro Max';

export type SimDevice = {
  readonly name: string;
  readonly udid: string;
  readonly state: string;
  readonly isAvailable?: boolean;
};
export type SimctlDeviceList = { readonly devices: Readonly<Record<string, readonly SimDevice[]>> };
export type Simctl = (args: readonly string[]) => string;

const PURPOSE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** `smoke` -> `e07-smoke`. Every simulator this tooling touches carries the prefix. */
export function simulatorName(purpose: string): string {
  if (!PURPOSE.test(purpose)) {
    throw new Error(`simulator purpose "${purpose}" must be kebab-case, for example "smoke"`);
  }
  return `${SIMULATOR_PREFIX}${purpose}`;
}

export function findSimulator(
  list: SimctlDeviceList,
  name: string,
  runtime: string,
): SimDevice | undefined {
  return (list.devices[runtime] ?? []).find(
    (device) => device.name === name && device.isAvailable !== false,
  );
}

/** A clean, static status bar (9:41, full battery without the charging bolt, full signal). */
export function statusBarArgs(udid: string): string[] {
  return [
    ...['status_bar', udid, 'override', '--time', '9:41'],
    ...['--dataNetwork', 'wifi', '--wifiMode', 'active', '--wifiBars', '3'],
    ...['--cellularMode', 'active', '--cellularBars', '4', '--operatorName', ''],
    ...['--batteryState', 'discharging', '--batteryLevel', '100'],
  ];
}

export function createSimctl(env: NodeJS.ProcessEnv): Simctl {
  return (args) =>
    execFileSync('xcrun', ['simctl', ...args], { encoding: 'utf8', env, maxBuffer: 64 << 20 });
}

/**
 * First boot of a new simulator: show a 12-hour clock (the host region may force 09:41) and
 * let the one-time system banner appear before any screenshot that matters is taken.
 */
function warmUp(simctl: Simctl, udid: string): void {
  simctl(['bootstatus', udid, '-b']);
  simctl(['spawn', udid, 'defaults', 'write', '-g', 'AppleLocale', '-string', 'en_US']);
  // simctl cannot write to /dev/null ("Operation not permitted"): use a throwaway file.
  const discard = join(tmpdir(), `e07-first-boot-${udid}.png`);
  simctl(['io', udid, 'screenshot', discard]);
  rmSync(discard, { force: true });
  simctl(['shutdown', udid]);
}

/** Returns the UDID of e07-<purpose> on IOS_RUNTIME, creating and warming it up when missing. */
export function ensureSimulator(simctl: Simctl, purpose: string, deviceType: string): string {
  const name = simulatorName(purpose);
  const list = JSON.parse(simctl(['list', 'devices', '--json'])) as SimctlDeviceList;
  const existing = findSimulator(list, name, IOS_RUNTIME);
  if (existing !== undefined) {
    return existing.udid;
  }
  const udid = simctl(['create', name, deviceType, IOS_RUNTIME]).trim();
  warmUp(simctl, udid);
  return udid;
}

/** Boots if needed, waits until ready and pins the status bar (overrides reset on every boot). */
export function bootForScreenshots(simctl: Simctl, udid: string): void {
  simctl(['bootstatus', udid, '-b']);
  simctl(statusBarArgs(udid));
}

export function installAndLaunch(simctl: Simctl, udid: string, app: AppOnDisk): void {
  simctl(['install', udid, app.path]);
  simctl(['launch', '--terminate-running-process', udid, app.bundleId]);
}

export type AppOnDisk = { readonly path: string; readonly bundleId: string };

/** Deletes a simulator this tooling created; refuses any other name. */
export function deleteOwnSimulator(simctl: Simctl, device: SimDevice): void {
  if (!device.name.startsWith(SIMULATOR_PREFIX)) {
    throw new Error(`refusing to delete "${device.name}": not an ${SIMULATOR_PREFIX}* simulator`);
  }
  simctl(['delete', device.udid]);
}
