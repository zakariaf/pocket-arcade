// packages/tooling/src/release/release-options.ts
// Pure parts of `npm run release:ios`: arguments, key path, auth flags and the xcodebuild/altool
// argument lists. The .p8 key is only ever named by path here; nothing in this module reads it.
import { join } from 'node:path';

import { resolveBuildVariant, type BuildVariant } from '@e07/shell/config/app-variant.ts';

export type ReleaseOptions = {
  readonly game: string;
  readonly variant: BuildVariant;
  readonly notes: readonly string[];
  readonly knownIssues: readonly string[];
};

export type AscIds = { readonly keyId: string; readonly issuerId: string; readonly teamId: string };

const USAGE =
  'usage: npm run release:ios -- --app <game-id> --variant test|store [--ads off|test|live] [--notes "..."]... [--known-issue "..."]...';
const SINGLE = new Set(['--app', '--variant', '--ads']);
const REPEATED = new Set(['--notes', '--known-issue']);

function readFlags(argv: readonly string[]): Map<string, string[]> {
  const flags = new Map<string, string[]>();
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index] ?? '';
    const value = argv[index + 1];
    const isKnown = SINGLE.has(flag) || REPEATED.has(flag);
    if (!isKnown || value === undefined || (SINGLE.has(flag) && flags.has(flag))) {
      throw new Error(`unexpected argument "${flag}". ${USAGE}`);
    }
    flags.set(flag, [...(flags.get(flag) ?? []), value]);
  }
  return flags;
}

/** The variant is required (no default): a release is always a deliberate test or store build. */
export function parseReleaseArgs(argv: readonly string[]): ReleaseOptions {
  const flags = readFlags(argv);
  const game = flags.get('--app')?.[0];
  const appVariant = flags.get('--variant')?.[0];
  if (game === undefined || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(game) || appVariant === undefined) {
    throw new Error(`--app and --variant are required. ${USAGE}`);
  }
  const variant = resolveBuildVariant({
    APP_VARIANT: appVariant,
    EXPO_PUBLIC_APP_VARIANT: appVariant,
    ADS_MODE: flags.get('--ads')?.[0],
  });
  return {
    game,
    variant,
    notes: flags.get('--notes') ?? [],
    knownIssues: flags.get('--known-issue') ?? [],
  };
}

export type ToolEnv = Readonly<Record<string, string | undefined>>;

/** Tools receive only the three IDs; a missing one is owner step O3. */
export function readAscIds(env: ToolEnv): AscIds {
  const missing = ['ASC_KEY_ID', 'ASC_ISSUER_ID', 'APPLE_TEAM_ID'].filter(
    (name) => (env[name] ?? '') === '',
  );
  if (missing.length > 0) {
    throw new Error(
      `${missing.join(', ')} not set. Owner step O3: export them in ~/.zshenv, then start a new shell.`,
    );
  }
  return {
    keyId: env['ASC_KEY_ID'] ?? '',
    issuerId: env['ASC_ISSUER_ID'] ?? '',
    teamId: env['APPLE_TEAM_ID'] ?? '',
  };
}

/** ~/.appstoreconnect/private_keys/AuthKey_<id>.p8: altool finds the key there by itself. */
export function ascKeyFile(home: string, keyId: string): string {
  return join(home, '.appstoreconnect', 'private_keys', `AuthKey_${keyId}.p8`);
}

/** Automatic signing with the team API key: the only signing method (no .p12, no manual profiles). */
export function xcodeAuthArgs(keyFile: string, ids: AscIds): string[] {
  return [
    '-allowProvisioningUpdates',
    ...['-authenticationKeyPath', keyFile],
    ...['-authenticationKeyID', ids.keyId],
    ...['-authenticationKeyIssuerID', ids.issuerId],
  ];
}

export function altoolAuthArgs(ids: AscIds): string[] {
  return ['--api-key', ids.keyId, '--api-issuer', ids.issuerId];
}

export type ArchiveTarget = { readonly workspace: string; readonly scheme: string };

export function archiveArgs(target: ArchiveTarget, auth: readonly string[]): string[] {
  return [
    ...['-workspace', target.workspace, '-scheme', target.scheme, '-configuration', 'Release'],
    ...['-destination', 'generic/platform=iOS'],
    ...['-archivePath', join('build', `${target.scheme}.xcarchive`)],
    ...['-derivedDataPath', join('build', 'dd-device'), ...auth, 'archive'],
  ];
}

/** Test builds use export-options-test.plist (internal TestFlight only), store builds the store one. */
export function exportArgs(
  scheme: string,
  variant: BuildVariant,
  auth: readonly string[],
): string[] {
  const options = join('..', '..', 'packages', 'tooling', 'config');
  return [
    '-exportArchive',
    ...['-archivePath', join('build', `${scheme}.xcarchive`)],
    ...['-exportOptionsPlist', join(options, `export-options-${variant.appVariant}.plist`)],
    ...['-exportPath', join('build', 'export'), ...auth],
  ];
}

export type UploadMeta = {
  readonly appleAppId: string;
  readonly bundleId: string;
  readonly buildNumber: number;
  readonly version: string;
};

export function validateArgs(ipa: string, ids: AscIds): string[] {
  return [
    'altool',
    '--validate-app',
    ipa,
    '-t',
    'ios',
    ...altoolAuthArgs(ids),
    '--output-format',
    'json',
  ];
}

/** `--wait` returns once Apple is PROCESSING, not VALID: processing is polled separately. */
export function uploadArgs(ipa: string, meta: UploadMeta, ids: AscIds): string[] {
  return [
    ...['altool', '--upload-package', ipa, '-t', 'ios'],
    ...['--apple-id', meta.appleAppId, '--bundle-id', meta.bundleId],
    ...['--bundle-version', String(meta.buildNumber)],
    ...['--bundle-short-version-string', meta.version],
    ...altoolAuthArgs(ids),
    ...['--wait', '--output-format', 'json'],
  ];
}
