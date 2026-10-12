// packages/tooling/src/release/release-options.ts
// Pure parts of `npm run release:ios`: arguments, key path, auth flags and the xcodebuild/altool
// argument lists. The .p8 key is only ever named by path here; nothing in this module reads it.
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { resolveBuildVariant, type BuildVariant } from '@e07/shell/config/app-variant.ts';
import { ascKeyPath, requireEnv } from '@e07/tooling/asc/asc-credentials.ts';
import { isGameId } from '@e07/tooling/build/game-id.ts';

import type { ToolEnv } from '@e07/tooling/ios/toolchain.ts';

/**
 * Where a stopped run picks up again. `build`: the committed build number is reused and the run
 * starts again at the prebuild (the stop came before the upload). `processing`: the upload is done,
 * so the run only waits for VALID, sets What to Test and tags.
 */
export const RESUME_POINTS = ['build', 'processing'] as const;
export type ResumePoint = (typeof RESUME_POINTS)[number];

export type ReleaseOptions = {
  readonly game: string;
  readonly variant: BuildVariant;
  readonly notes: readonly string[];
  readonly knownIssues: readonly string[];
  readonly resume: ResumePoint | null;
};

export type AscIds = { readonly keyId: string; readonly issuerId: string; readonly teamId: string };

const USAGE =
  'usage: npm run release:ios -- --app <game-id> --variant test|store [--ads off|test|live] [--notes "..."]... [--known-issue "..."]... [--resume build|processing]';
const OPTIONS = {
  app: { type: 'string' },
  variant: { type: 'string' },
  ads: { type: 'string' },
  resume: { type: 'string' },
  notes: { type: 'string', multiple: true },
  'known-issue': { type: 'string', multiple: true },
} as const;
const SINGLE = ['app', 'variant', 'ads', 'resume'];

/** node:util parseArgs, strict: an unknown option, a stray word or a repeated single option throws. */
function readFlags(argv: readonly string[]): ReturnType<typeof parseFlags>['values'] {
  let parsed: ReturnType<typeof parseFlags>;
  try {
    parsed = parseFlags(argv);
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`unexpected argument: ${reason} ${USAGE}`);
  }
  const names = parsed.tokens.flatMap((token) => (token.kind === 'option' ? [token.name] : []));
  const repeated = SINGLE.find((name) => names.filter((found) => found === name).length > 1);
  if (repeated !== undefined)
    throw new Error(`unexpected argument "--${repeated}" (twice). ${USAGE}`);
  return parsed.values;
}

function parseFlags(argv: readonly string[]) {
  return parseArgs({ args: [...argv], options: OPTIONS, tokens: true });
}

/** The variant is required (no default): a release is always a deliberate test or store build. */
export function parseReleaseArgs(argv: readonly string[]): ReleaseOptions {
  const flags = readFlags(argv);
  const game = flags.app;
  const appVariant = flags.variant;
  if (!isGameId(game) || appVariant === undefined) {
    throw new Error(`--app and --variant are required. ${USAGE}`);
  }
  const variant = resolveBuildVariant({
    APP_VARIANT: appVariant,
    EXPO_PUBLIC_APP_VARIANT: appVariant,
    ADS_MODE: flags.ads,
  });
  return {
    game,
    variant,
    notes: flags.notes ?? [],
    knownIssues: flags['known-issue'] ?? [],
    resume: parseResume(flags.resume),
  };
}

function parseResume(raw: string | undefined): ResumePoint | null {
  if (raw === undefined) {
    return null;
  }
  const point = RESUME_POINTS.find((candidate) => candidate === raw);
  if (point === undefined) {
    throw new Error(`--resume ${raw} is not one of ${RESUME_POINTS.join('|')}. ${USAGE}`);
  }
  return point;
}

/** Tools receive only the three IDs; a missing one is owner step O3 (all missing ones named). */
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
    keyId: requireEnv(env, 'ASC_KEY_ID'),
    issuerId: requireEnv(env, 'ASC_ISSUER_ID'),
    teamId: requireEnv(env, 'APPLE_TEAM_ID'),
  };
}

/** The key's path (asc-credentials' ascKeyPath under `home`); nothing here reads the key. */
export function ascKeyFile(home: string, keyId: string): string {
  return ascKeyPath(keyId, home);
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
