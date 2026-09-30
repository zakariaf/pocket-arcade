// packages/tooling/src/asc/print-app-record.ts
// CLI: node packages/tooling/src/asc/print-app-record.ts <bundleId>   (prints {"id","name"} or exits 2)
import { loadAscCredentials } from '@e07/tooling/asc/asc-credentials.ts';
import { createAscJwt } from '@e07/tooling/asc/asc-jwt.ts';
import { findAppByBundleId } from '@e07/tooling/asc/find-app.ts';
import { nowEpochSeconds } from '@e07/tooling/clock/system-clock.ts';

const EXIT_NO_APP_RECORD = 2;
const bundleId = process.argv[2];

if (bundleId === undefined) {
  console.error('usage: print-app-record.ts <bundleId>');
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
