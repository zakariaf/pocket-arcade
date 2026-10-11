// packages/tooling/src/audit/sample-sockets.ts
// Layer F sampler. Usage: node packages/tooling/src/audit/sample-sockets.ts <AppName> <report> <udid>...
// The E2E runner (run-e2e-ios.ts) spawns it before `maestro test`, once per simulator of the run (the
// phone, then the iPad of the large-text step), and kills it afterwards; any line in <report> fails
// the run. One sample per second, of the app's copies on the named simulators only: other sessions
// run the same app on theirs (an ADS_MODE=test build legitimately opens Google sockets there).
// After every sample it writes its status (samples, samples that found the app, errors) to
// <report>.sampler-<udid>.json: the runner accepts an empty report as N3 evidence only from a
// sampler still sampling at the end that found the app and reported no error.
import { appendFileSync, writeFileSync } from 'node:fs';

import {
  appPids,
  NEW_SAMPLER_STATUS,
  nextSamplerStatus,
  samplerStatusPath,
  samplerStatusText,
  sampleSockets,
} from './network-runtime-layer.ts';

const [appName, report, ...udids] = process.argv.slice(2);
if (appName === undefined || report === undefined || udids.length === 0) {
  throw new Error('usage: sample-sockets.ts <AppName> <report-file> <udid>...');
}
const statusFile = samplerStatusPath(report, udids);
let status = NEW_SAMPLER_STATUS;

function sample(app: string, out: string): void {
  let pids: string[] = [];
  let error: unknown = null;
  try {
    pids = appPids(app, udids);
    for (const pid of pids) {
      for (const line of sampleSockets(pid)) appendFileSync(out, `${line}\n`);
    }
  } catch (caught: unknown) {
    error = caught;
  }
  status = nextSamplerStatus(status, { pids: pids.length, error });
  writeFileSync(statusFile, samplerStatusText(status));
}

sample(appName, report);
setInterval(() => {
  sample(appName, report);
}, 1000);
