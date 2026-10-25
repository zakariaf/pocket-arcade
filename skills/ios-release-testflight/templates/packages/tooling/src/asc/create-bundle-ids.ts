// packages/tooling/src/asc/create-bundle-ids.ts
// Usage: node packages/tooling/src/asc/create-bundle-ids.ts --app <game-id> [--app <game-id> ...]
// Needs ASC_KEY_ID and ASC_ISSUER_ID (team API key). Registers io.applander.<game id without
// hyphens> (O4) as an explicit iOS bundle id for each game, so the owner can pick it in App Store
// Connect's New App form (owner step G2). Re-running is safe: a registered bundle id is kept. A game
// id that is not one stops with the usage (exit 2) before the key is read (bundle-id-setup.ts,
// which does the work on these App Store Connect calls).
import { nowEpochSeconds } from '@e07/tooling/clock/system-clock.ts';

import { ascRequest } from './asc-client.ts';
import { loadAscCredentials } from './asc-credentials.ts';
import { createAscJwt } from './asc-jwt.ts';
import { createBundleIds } from './bundle-id-setup.ts';

process.exitCode = await createBundleIds(process.argv.slice(2), {
  token: () => createAscJwt(loadAscCredentials(process.env), nowEpochSeconds()),
  request: ascRequest,
  log: (line) => {
    console.error(line);
  },
});
