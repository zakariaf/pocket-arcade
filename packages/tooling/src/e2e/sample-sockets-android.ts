// packages/tooling/src/e2e/sample-sockets-android.ts
// device-only: covered by npm run e2e:android on an e07-android-* emulator (network-samplers.json, check-e2e-report --platform android)
// Layer F sampler on Android. Usage: node packages/tooling/src/e2e/sample-sockets-android.ts
// <package> <report> <serial>. run-e2e-android.ts spawns one per emulator of the run and kills it at
// the end; any line in <report> fails the run. Once a second, on this emulator only: the app's uid
// (cmd package list packages -U, until it is known: an installed app keeps its uid), then one adb
// call for whether it runs (pidof) and the four /proc/net socket tables, keeping the uid's
// connections to anything but the device itself (android-socket-sampler.ts).
// After every sample it rewrites <report>.sampler-<serial>.json with the same status the iOS
// sampler writes (network-runtime-layer.ts), so proveSamplersAlive judges both alike.
import { appendFileSync, writeFileSync } from 'node:fs';

import { toolsOf } from '@e07/tooling/android/emulator-device.ts';
import {
  NEW_SAMPLER_STATUS,
  nextSamplerStatus,
  samplerStatusPath,
  samplerStatusText,
} from '@e07/tooling/audit/network-runtime-layer.ts';
import { packageUidArgs, procNetArgs } from '@e07/tooling/e2e/android-device-args.ts';
import { adbOn, androidEnv, type Device } from '@e07/tooling/e2e/android-e2e-device.ts';
import {
  appConnections,
  appUidOf,
  parseProcNet,
  pidOf,
} from '@e07/tooling/e2e/android-socket-sampler.ts';

/** The three arguments, or a usage error. */
function argsOf(argv: readonly string[]): { packageName: string; report: string; serial: string } {
  const [packageName, report, serial] = argv;
  if (packageName === undefined || report === undefined || serial === undefined) {
    throw new Error('usage: sample-sockets-android.ts <package> <report-file> <serial>');
  }
  return { packageName, report, serial };
}

const { packageName, report, serial } = argsOf(process.argv.slice(2));
const env = androidEnv();
const device: Device = { serial, env, tools: toolsOf(env) };
const statusFile = samplerStatusPath(report, [serial]);
let status = NEW_SAMPLER_STATUS;

/** The app's uid, looked up until it is known (null before the APK is installed). */
let uid: number | null = null;

function sample(name: string, out: string): void {
  let pids = 0;
  let error: unknown = null;
  try {
    uid ??= appUidOf(adbOn(device, packageUidArgs(serial, name)), name);
    // pidof first, then the socket tables: pidOf reads the first line, parseProcNet the tables.
    const output = adbOn(device, procNetArgs(serial, name));
    pids = pidOf(output) === null ? 0 : 1;
    if (uid !== null) {
      const lines = appConnections(parseProcNet(output), uid);
      for (const line of lines) appendFileSync(out, `${serial} ${line}\n`);
    }
  } catch (caught: unknown) {
    error = caught;
  }
  status = nextSamplerStatus(status, { pids, error });
  writeFileSync(statusFile, samplerStatusText(status));
}

sample(packageName, report);
setInterval(() => {
  sample(packageName, report);
}, 1000);
