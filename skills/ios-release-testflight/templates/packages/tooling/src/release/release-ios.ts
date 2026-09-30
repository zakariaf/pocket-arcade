// packages/tooling/src/release/release-ios.ts
// CLI: npm run release:ios -- --app <game-id> --variant test|store [--ads off|test|live]
//        [--notes "what testers should check"]... [--known-issue "..."]... [--resume build|processing]
// Preflight -> build number +1 (committed) -> clean prebuild + audits -> signed archive -> export
// -> store-artifact gate -> validate -> upload -> wait for VALID -> What to Test -> build tag.
// Stops on the first failure; owner stops print one message and are never retried. After the
// owner confirms, the printed "Resume:" line says how to rerun (same number or a new one).
import { join } from 'node:path';

import { selectXcode } from '@e07/tooling/ios/toolchain.ts';
import { buildTag } from '@e07/tooling/release/build-number.ts';
import { buildIpa, runStoreGate } from '@e07/tooling/release/release-build.ts';
import { parseReleaseArgs } from '@e07/tooling/release/release-options.ts';
import { bumpAndCommit, preflight } from '@e07/tooling/release/release-preflight.ts';
import {
  describeAndTag,
  validateAndUpload,
  waitUntilValid,
} from '@e07/tooling/release/release-upload.ts';

import type { ReleaseOptions } from '@e07/tooling/release/release-options.ts';
import type { ReleaseContext } from '@e07/tooling/release/release-runner.ts';

function releaseContext(options: ReleaseOptions): ReleaseContext {
  const { appVariant, adsMode } = options.variant;
  // The three variant variables stay exported for every step (prebuild, Constants, Metro).
  const env = {
    ...selectXcode(process.env),
    APP_VARIANT: appVariant,
    EXPO_PUBLIC_APP_VARIANT: appVariant,
    ADS_MODE: adsMode,
  };
  return { game: options.game, appDir: join('apps', options.game), env };
}

function report(options: ReleaseOptions, tag: string, whatToTestText: string): void {
  const kind =
    options.variant.appVariant === 'store' ? 'store build' : 'test build (internal testers only)';
  console.log(
    `release:ios: ${tag} uploaded, processed (VALID) and available in TestFlight as a ${kind}.`,
  );
  console.log('release:ios: What to Test:');
  console.log(whatToTestText);
  if (options.variant.appVariant === 'store') {
    console.log(
      'release:ios: ask the owner to play it and answer "ship" or "don\'t ship" (owner step R1).',
    );
  }
}

async function main(): Promise<number> {
  const options = parseReleaseArgs(process.argv.slice(2));
  const context = releaseContext(options);
  const pre = await preflight(options, context);
  const buildNumber = bumpAndCommit(options, context);
  // --resume processing: the upload of this build number already reached Apple.
  if (options.resume !== 'processing') {
    const built = buildIpa(options, context, pre);
    runStoreGate({ built, options, buildNumber, version: pre.app.version });
    validateAndUpload({ ipa: built.ipa, pre, buildNumber }, context);
  }
  const restId = await waitUntilValid(pre, buildNumber, context.env);
  const text = await describeAndTag({ options, pre, buildNumber, restId }, context.env);
  report(options, buildTag(options.game, pre.app.version, buildNumber), text);
  return 0;
}

try {
  process.exitCode = await main();
} catch (error: unknown) {
  console.error(`release:ios: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
