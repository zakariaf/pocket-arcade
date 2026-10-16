// packages/tooling/src/audit/sample-sockets.ts
// Layer F sampler. Usage: node packages/tooling/src/audit/sample-sockets.ts <AppName> <report> <udid>...
// The E2E runner (run-e2e-ios.ts) spawns it before `maestro test`, once per simulator of the run (the
// phone, then the iPad of the large-text step), and kills it afterwards; any line in <report> fails
// the run. One sample per second, of the app's copies on the named simulators only: other sessions
// run the same app on theirs (an ADS_MODE=test build legitimately opens Google sockets there).
import { appendFileSync } from 'node:fs';

import { appPids, sampleSockets } from './network-runtime-layer.ts';

const [appName, report, ...udids] = process.argv.slice(2);
if (appName === undefined || report === undefined || udids.length === 0) {
  throw new Error('usage: sample-sockets.ts <AppName> <report-file> <udid>...');
}
setInterval(() => {
  for (const pid of appPids(appName, udids)) {
    for (const line of sampleSockets(pid)) appendFileSync(report, `${line}\n`);
  }
}, 1000);
