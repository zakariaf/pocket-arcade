// packages/tooling/src/asc/create-premium-iap.ts
// Usage: node packages/tooling/src/asc/create-premium-iap.ts io.applander.<game id without hyphens>
// Needs ASC_KEY_ID and ASC_ISSUER_ID (team API key). Re-running is safe: it reuses the product, skips
// locales that exist, and posting a price schedule again replaces the schedule. The price is the
// owner's EUR 1.99 price point (O2); the product is created with Family Sharing off (O3). A bundle
// id outside io.applander.<id> stops with the usage (exit 2) before the key is read
// (premium-iap-setup.ts, which does the work on these App Store Connect calls).
import { nowEpochSeconds } from '@e07/tooling/clock/system-clock.ts';

import { ascRequest } from './asc-client.ts';
import { loadAscCredentials } from './asc-credentials.ts';
import { createAscJwt } from './asc-jwt.ts';
import { createPremiumIap } from './premium-iap-setup.ts';

const TARGET_EUR = 1.99; // owner decision O2, 2026-09-30: the EUR 1.99 App Store price point

process.exitCode = await createPremiumIap(process.argv.slice(2), {
  token: () => createAscJwt(loadAscCredentials(process.env), nowEpochSeconds()),
  request: ascRequest,
  targetEur: TARGET_EUR,
  log: (line) => {
    console.error(line);
  },
});
