// packages/tooling/src/asc/print-app-record.ts
// CLI: node packages/tooling/src/asc/print-app-record.ts --app <game-id>   (or the bundle id itself)
// Prints {"id","name"} of the App Store Connect app record for io.applander.<game id without
// hyphens> (owner decision O4: every game's bundle id), or exits 2 when there is none (owner step G2).
import { loadAscCredentials } from '@e07/tooling/asc/asc-credentials.ts';
import { createAscJwt } from '@e07/tooling/asc/asc-jwt.ts';
import { findAppByBundleId } from '@e07/tooling/asc/find-app.ts';
import { nowEpochSeconds } from '@e07/tooling/clock/system-clock.ts';
import { appIdOf } from '@e07/tooling/release/store-gate.ts';

const EXIT_NO_APP_RECORD = 2;
const APP_ID = /^io\.applander\.[a-z0-9]+$/;
const [first, second] = process.argv.slice(2);
const bundleId = first === '--app' && second !== undefined ? appIdOf(second) : first;

if (bundleId === undefined || !APP_ID.test(bundleId)) {
  console.error(
    `usage: print-app-record.ts --app <game-id> | io.applander.<game id without hyphens> (got ${String(bundleId)})`,
  );
  process.exitCode = 1;
} else {
  const token = createAscJwt(loadAscCredentials(process.env), nowEpochSeconds());
  const app = await findAppByBundleId(token, bundleId);
  if (app === null) {
    console.error(
      `No App Store Connect app record for ${bundleId}. Owner step G2: create the app record in App Store Connect.`,
    );
    process.exitCode = EXIT_NO_APP_RECORD;
  } else {
    process.stdout.write(`${JSON.stringify(app)}\n`);
  }
}
