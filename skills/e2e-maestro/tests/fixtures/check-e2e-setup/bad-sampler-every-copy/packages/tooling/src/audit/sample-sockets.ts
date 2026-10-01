// packages/tooling/src/audit/sample-sockets.ts
// Layer F sampler. Usage: node packages/tooling/src/audit/sample-sockets.ts <AppName> <report>
// The E2E runner (run-e2e-ios.ts) spawns it before `maestro test` and kills it afterwards; any line in
// <report> fails the run. One sample per second.
import { appendFileSync } from 'node:fs';

import { appPids, sampleSockets } from './network-runtime-layer.ts';

const [appName, report] = process.argv.slice(2);
if (appName === undefined || report === undefined) {
  throw new Error('usage: sample-sockets.ts <AppName> <report-file>');
}
setInterval(() => {
  for (const pid of appPids(appName)) {
    for (const line of sampleSockets(pid)) appendFileSync(report, `${line}\n`);
  }
}, 1000);
