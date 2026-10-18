// packages/tooling/src/release-android/release-android-plan.ts
// Pure parts of `npm run release:android`: arguments, the preflight refusals, the store-AAB gate
// stamp that must match the bytes before any upload, and the paths. Only the internal track is
// ever written: promoting a release is the owner's step in the Play Console.
import { join } from 'node:path';

import { isGameId } from '@e07/tooling/build/game-id.ts';

export type ReleaseAndroidOptions = {
  readonly game: string;
  readonly track: 'internal';
  /** `upload`: the AAB was built and gated by an earlier run; upload it, build nothing. */
  readonly resume: 'upload' | null;
  readonly notes: string | null;
};

/** What the preflight reads from the repo before anything is bumped or built. */
export type ReleaseState = {
  readonly branch: string;
  readonly isTreeClean: boolean;
  readonly isVerifyGreen: boolean;
  readonly hasShellSlice: boolean;
  /** check-release-setup-android's pending owner steps (G3, GP5 ...), empty when none. */
  readonly ownerStepsPending: readonly string[];
};

/** What check-store-aab.mjs --stamp writes after a PASS on one AAB. */
export type GateStamp = {
  readonly result: string;
  readonly sha256: string;
  readonly versionCode: number;
  readonly isUnsigned: boolean;
};

export const RELEASE_ANDROID_USAGE = [
  'usage: npm run release:android -- --app <game-id> [--track internal] [--notes <text>] [--resume upload]',
  '  --app      the game folder under apps/ (kebab-case)',
  "  --track    internal (the only track this tool writes; promotion is the owner's)",
  '  --notes    release notes for testers (en-US)',
  '  --resume   upload: upload the AAB an earlier run built, once check-store-aab.mjs --stamp passed on it',
  '  --help, -h print this and exit',
].join('\n');

const FLAGS = new Set(['--app', '--track', '--notes', '--resume']);

function readFlags(argv: readonly string[]): ReadonlyMap<string, string> {
  const flags = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index] ?? '';
    const value = argv[index + 1];
    if (!FLAGS.has(flag) || value === undefined || value.startsWith('--')) {
      throw new Error(`unexpected argument "${flag}". ${RELEASE_ANDROID_USAGE}`);
    }
    flags.set(flag, value);
  }
  return flags;
}

export function parseReleaseAndroidArgs(argv: readonly string[]): ReleaseAndroidOptions {
  const flags = readFlags(argv);
  const game = flags.get('--app');
  if (!isGameId(game)) {
    throw new Error(`--app <game-id> is required. ${RELEASE_ANDROID_USAGE}`);
  }
  const track = flags.get('--track') ?? 'internal';
  if (track !== 'internal') {
    throw new Error(`--track ${track}: only internal is written here; promotion is the owner's`);
  }
  const resume = flags.get('--resume') ?? null;
  if (resume !== null && resume !== 'upload') {
    throw new Error(`--resume ${resume}: the only resume point is upload`);
  }
  return { game, track, resume, notes: flags.get('--notes') ?? null };
}

/** Every reason this commit may not be released; empty when the release may start. */
export function preflightProblems(state: ReleaseState): string[] {
  return [
    ...(state.isTreeClean
      ? []
      : [
          'the working tree is not clean: commit or stash first (the release commits the build number)',
        ]),
    ...(state.branch === 'main' ? [] : [`releases come from main, this is ${state.branch}`]),
    ...(state.isVerifyGreen ? [] : ['npm run verify is not green on this commit']),
    ...(state.hasShellSlice ? ['shell-slice.json exists: a partial Shell never ships'] : []),
    ...(state.ownerStepsPending.length === 0
      ? []
      : [
          `owner steps pending: ${state.ownerStepsPending.join(', ')} (the store build would carry placeholders)`,
        ]),
  ];
}

/** The upload goes out only for the exact bytes the store-AAB gate passed, never a rehearsal. */
export function uploadProblems(input: {
  readonly stamp: GateStamp | null;
  readonly aabSha256: string;
  readonly versionCode: number;
}): string[] {
  const { stamp } = input;
  if (stamp === null)
    return ['no store-AAB gate stamp: run check-store-aab.mjs with --stamp first'];
  if (stamp.result !== 'PASS')
    return ['the store-AAB gate did not pass: fix every FAIL line first'];
  if (stamp.isUnsigned) return ['the stamp is from a keyless rehearsal, never release evidence'];
  if (stamp.sha256 !== input.aabSha256) {
    return ['the AAB changed after the gate (sha256 differs): run check-store-aab.mjs again'];
  }
  if (stamp.versionCode !== input.versionCode) {
    return [
      `the gate checked versionCode ${String(stamp.versionCode)}, this release is ${String(input.versionCode)}`,
    ];
  }
  return [];
}

/** The Play bundle; assembleRelease (the emulator APK) belongs to build:android:emu. */
export const BUNDLE_RELEASE_ARGS = ['bundleRelease', '--console=plain'];

export function aabPath(appDir: string): string {
  return join(appDir, 'android', 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab');
}

export function gateStampPath(appDir: string): string {
  return join(appDir, 'build', 'release', 'aab-gate.json');
}

export type OwnerValues = {
  readonly ads: {
    readonly isEnabled: boolean;
    readonly ids: {
      readonly android: {
        readonly appId: string;
        readonly units: Readonly<Record<string, string>>;
      } | null;
    };
  };
  readonly links: {
    readonly privacyPolicy: { readonly host: string };
    readonly supportEmail: string;
  };
};

/** The scaffold's AdMob placeholders (Google's documented examples) and links (owner steps G5, G3). */
const PLACEHOLDER_PUBLISHER = 'ca-app-pub-1234567890123456';
/** Google's sample publisher: its test ids belong to test builds (ads-config.ts), never here. */
const SAMPLE_PUBLISHER = 'ca-app-pub-3940256099942544';
const PLACEHOLDER_LINKS = { host: 'example.com', supportEmail: 'support@example.com' } as const;

function isStandInAdId(id: string): boolean {
  return id.startsWith(PLACEHOLDER_PUBLISHER) || id.startsWith(SAMPLE_PUBLISHER);
}

/**
 * The owner steps a Play store build still waits for: G3 (the privacy-policy host and the support
 * address) and GP5 (the AdMob Android app and its three units, when the game shows ads; Google's
 * test ids are no stand-in: a live build with them shows test ads and earns nothing).
 */
export function ownerStepsOf(config: OwnerValues): string[] {
  const { links, ads } = config;
  const isLinkPlaceholder =
    links.privacyPolicy.host === PLACEHOLDER_LINKS.host ||
    links.supportEmail === PLACEHOLDER_LINKS.supportEmail;
  const android = ads.ids.android;
  const androidIds = android === null ? [] : [android.appId, ...Object.values(android.units)];
  const isAndroidAdsMissing = ads.isEnabled && (android === null || androidIds.some(isStandInAdId));
  return [...(isLinkPlaceholder ? ['G3'] : []), ...(isAndroidAdsMissing ? ['GP5'] : [])];
}
