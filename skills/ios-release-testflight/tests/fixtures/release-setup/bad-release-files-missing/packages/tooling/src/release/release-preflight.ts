// packages/tooling/src/release/release-preflight.ts
// Release steps 0-2: what must be true before anything is built or uploaded, the app's identity
// from the resolved Expo config, and the build-number bump commit.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { loadAscCredentials } from '@e07/tooling/asc/asc-credentials.ts';
import { createAscJwt } from '@e07/tooling/asc/asc-jwt.ts';
import { findAppByBundleId } from '@e07/tooling/asc/find-app.ts';
import { nowEpochSeconds } from '@e07/tooling/clock/system-clock.ts';
import { bumpBuildNumber } from '@e07/tooling/release/build-number.ts';
import { isVersionAboveLastRelease } from '@e07/tooling/release/processing.ts';
import {
  ascKeyFile,
  readAscIds,
  type AscIds,
  type ReleaseOptions,
} from '@e07/tooling/release/release-options.ts';
import { runReleaseStep, type ReleaseContext } from '@e07/tooling/release/release-runner.ts';

export type AppIdentity = {
  readonly name: string;
  readonly bundleId: string;
  readonly version: string;
  readonly appleAppId: string;
};

function git(args: readonly string[]): string {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function assertCleanMain(): void {
  if (git(['status', '--porcelain']) !== '') {
    throw new Error(
      'the working tree is not clean: commit or stash first (a release builds one commit)',
    );
  }
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
  if (branch !== 'main') {
    throw new Error(`releases are made from main, not "${branch}"`);
  }
}

/** Checks the key file by path and mode only: it is never opened, printed or copied here. */
function assertKeyFile(ids: AscIds): string {
  const keyFile = ascKeyFile(homedir(), ids.keyId);
  if (!existsSync(keyFile)) {
    throw new Error(
      `no key file AuthKey_${ids.keyId}.p8 in ~/.appstoreconnect/private_keys. Owner step O3.`,
    );
  }
  if ((statSync(keyFile).mode & 0o777) !== 0o600) {
    throw new Error(
      `the key file must be mode 600 (chmod 600 on AuthKey_${ids.keyId}.p8). Owner step O3.`,
    );
  }
  return keyFile;
}

function assertKeychainUnlocked(): void {
  const keychain = join(homedir(), 'Library', 'Keychains', 'login.keychain-db');
  if (spawnSync('security', ['show-keychain-info', keychain]).status !== 0) {
    throw new Error(
      'the login keychain is locked: owner step O8 (unlock it on the Mac, then rerun)',
    );
  }
}

/** Name, bundle ID and version as app.config.ts resolves them for this variant. */
function readIdentity(context: ReleaseContext): Omit<AppIdentity, 'appleAppId'> {
  const json = runReleaseStep(
    'expo-config',
    { file: 'npx', args: ['expo', 'config', '--json', '--type', 'public'] },
    context,
  );
  const config = JSON.parse(json) as {
    name?: string;
    version?: string;
    ios?: { bundleIdentifier?: string };
  };
  const { name = '', version = '', ios } = config;
  const bundleId = ios?.bundleIdentifier ?? '';
  if (name === '' || version === '' || bundleId === '') {
    throw new Error('app.config.ts resolved without name, version or ios.bundleIdentifier');
  }
  return { name, version, bundleId };
}

/** Store builds ship fa/ckb text only after a native speaker reviewed it (owner steps G7/R3). */
function assertTranslationsReviewed(context: ReleaseContext): void {
  const reviewSheet = join('packages', 'tooling', 'src', 'i18n', 'review-sheet.ts');
  if (!existsSync(reviewSheet)) {
    throw new Error(
      `${reviewSheet} is missing: the fa/ckb review gate must exist before a store release`,
    );
  }
  runReleaseStep(
    'i18n-review',
    { file: 'node', args: [reviewSheet, '--release'], atRoot: true },
    context,
  );
}

async function lookUpAppleAppId(bundleId: string, env: NodeJS.ProcessEnv): Promise<string> {
  const token = createAscJwt(loadAscCredentials(env), nowEpochSeconds());
  const app = await findAppByBundleId(token, bundleId);
  if (app === null) {
    throw new Error(
      `No App Store Connect app record for ${bundleId}. Owner step G2: create it (My Apps > + > New App).`,
    );
  }
  return app.id;
}

export type Preflight = {
  readonly ids: AscIds;
  readonly keyFile: string;
  readonly app: AppIdentity;
};

/** Step 1: stop on the first failure, before anything is built, committed or uploaded. */
export async function preflight(
  options: ReleaseOptions,
  context: ReleaseContext,
): Promise<Preflight> {
  assertCleanMain();
  const ids = readAscIds(context.env);
  const keyFile = assertKeyFile(ids);
  assertKeychainUnlocked();
  runReleaseStep('verify', { file: 'npm', args: ['run', '-s', 'verify'], atRoot: true }, context);
  const identity = readIdentity(context);
  if (options.variant.appVariant === 'store') {
    assertTranslationsReviewed(context);
    const tags = git(['tag', '--list', `${options.game}/v*`]).split('\n');
    if (!isVersionAboveLastRelease(identity.version, tags, options.game)) {
      throw new Error(
        `version ${identity.version} is not above the last release tag: raise it in game.config.ts (ITMS-90062)`,
      );
    }
  }
  const appleAppId = await lookUpAppleAppId(identity.bundleId, context.env);
  return { ids, keyFile, app: { ...identity, appleAppId } };
}

/** Step 2: +1 on the single buildNumber line, committed before the archive; never rolled back. */
export function bumpAndCommit(options: ReleaseOptions, context: ReleaseContext): number {
  const file = join(context.appDir, 'game.config.ts');
  const bump = bumpBuildNumber(readFileSync(file, 'utf8'));
  writeFileSync(file, bump.text);
  git(['add', file]);
  git([
    'commit',
    '-m',
    `chore(${options.game}): build ${String(bump.next)}`,
    '-m',
    `Release-Variant: ${options.variant.appVariant}`,
  ]);
  return bump.next;
}
