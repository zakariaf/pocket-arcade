// packages/tooling/src/release-android/release-android.ts
// device-only: covered by the internal-testing release of Android step 8 (check-store-aab.mjs, then the Play upload)
// CLI: npm run release:android -- --app <game-id> [--track internal] [--notes <text>] [--resume upload]
// Run 1 (build): preflight on a clean main (verify green, no partial Shell, no owner step pending,
// the upload key in place), the next build number (shared with iOS, never reused) committed as
// chore(<game>): build <n>, a clean Android prebuild of the store/live variant, Gradle
// bundleRelease signed with the upload key (Gradle reads its passwords from ~/.gradle), and the
// command for the store-AAB gate. Run 2 (--resume upload): only when check-store-aab.mjs --stamp
// passed on these exact bytes, the upload to the internal track through the Play API, then the
// local tag <game>/v<version>+<n>. A stop is never retried; nothing is pushed.
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { selectAndroidToolchain } from '@e07/tooling/android/toolchain.ts';
import { variantEnv } from '@e07/tooling/build/emu-build-plan.ts';
import { nowEpochSeconds } from '@e07/tooling/clock/system-clock.ts';
import { runToolStep, tailOf } from '@e07/tooling/ios/tool-step.ts';
import { bumpBuildNumber, buildTag } from '@e07/tooling/release/build-number.ts';
import { keystoreProblems, uploadKeyPathOf } from '@e07/tooling/release-android/aab-signing.ts';
import {
  createPlayClient,
  PlayStop,
  uploadToInternal,
} from '@e07/tooling/release-android/play-client.ts';
import {
  loadServiceAccount,
  serviceAccountPathOf,
} from '@e07/tooling/release-android/play-credentials.ts';
import {
  aabPath,
  BUNDLE_RELEASE_ARGS,
  gateStampPath,
  ownerStepsOf,
  parseReleaseAndroidArgs,
  preflightProblems,
  RELEASE_ANDROID_USAGE,
  uploadProblems,
  type GateStamp,
  type OwnerValues,
  type ReleaseAndroidOptions,
} from '@e07/tooling/release-android/release-android-plan.ts';
import {
  assertUnusedVersionCode,
  nextVersionCode,
} from '@e07/tooling/release-android/version-code.ts';

import type { Http } from '@e07/tooling/release-android/play-client.ts';

type GameValues = OwnerValues & {
  readonly bundleId: string;
  readonly version: string;
  readonly buildNumber: number;
};

/** The repo is not ready (exit 2): nothing was bumped, built or sent. */
class StopError extends Error {}

const STORE_VARIANT = { appVariant: 'store', adsMode: 'live' } as const;

function git(args: readonly string[]): string {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

async function readGame(game: string): Promise<GameValues> {
  const file = resolve('apps', game, 'game.config.ts');
  if (!existsSync(file)) throw new StopError(`${file} not found: run from the repo root`);
  const module = (await import(pathToFileURL(file).href)) as { gameConfig: GameValues };
  return module.gameConfig;
}

function statOf(path: string): { isFile: boolean; mode: number } | null {
  return existsSync(path) ? { isFile: statSync(path).isFile(), mode: statSync(path).mode } : null;
}

function preflight(options: ReleaseAndroidOptions, config: GameValues): void {
  const quick = {
    branch: git(['rev-parse', '--abbrev-ref', 'HEAD']),
    isTreeClean: git(['status', '--porcelain']) === '',
    hasShellSlice: existsSync('shell-slice.json'),
    ownerStepsPending: ownerStepsOf(config),
  };
  const key = uploadKeyPathOf(options.game, homedir());
  const early = [
    ...preflightProblems({ ...quick, isVerifyGreen: true }),
    ...keystoreProblems({ path: key, repoRoot: process.cwd(), stat: statOf(key) }),
  ];
  if (early.length > 0)
    throw new StopError(`preflight failed, nothing was built:\n  ${early.join('\n  ')}`);
  console.log('release:android: npm run verify ...');
  const verify = spawnSync('npm', ['run', '-s', 'verify'], { stdio: 'inherit' });
  const late = preflightProblems({ ...quick, isVerifyGreen: verify.status === 0 });
  if (late.length > 0)
    throw new StopError(`preflight failed, nothing was built:\n  ${late.join('\n  ')}`);
}

/** The next build number, shared with iOS and never reused, committed before the build. */
function bumpAndCommit(game: string, config: GameValues): number {
  const tags = git(['tag', '--list', `${game}/v*`])
    .split('\n')
    .filter(Boolean);
  const versionCode = nextVersionCode({ game, configBuildNumber: config.buildNumber, tags });
  assertUnusedVersionCode(versionCode, game, tags);
  const file = join('apps', game, 'game.config.ts');
  const bump = bumpBuildNumber(readFileSync(file, 'utf8'));
  if (bump.next !== versionCode) {
    throw new StopError(
      `buildNumber ${String(bump.previous)} is behind the tags (next is ${String(versionCode)}): set it to ${String(versionCode - 1)} in its own commit first`,
    );
  }
  writeFileSync(file, bump.text);
  git(['add', file]);
  git([
    'commit',
    '-m',
    `chore(${game}): build ${String(versionCode)}`,
    '-m',
    'Release-Variant: store',
  ]);
  return versionCode;
}

type Step = { readonly name: string; readonly file: string; readonly args: readonly string[] };

function runStep(step: Step, context: { appDir: string; env: NodeJS.ProcessEnv }): void {
  console.log(`release:android: ${step.name} ...`);
  const result = runToolStep(step.name, { file: step.file, args: step.args }, context);
  if (result.status !== 0) {
    throw new Error(
      `step "${step.name}" failed (exit ${String(result.status)}), see ${result.logFile}:\n${tailOf(result.output, 30)}`,
    );
  }
}

function sha256Of(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

async function build(options: ReleaseAndroidOptions, config: GameValues): Promise<number> {
  preflight(options, config);
  const versionCode = bumpAndCommit(options.game, config);
  const appDir = join('apps', options.game);
  const env = { ...selectAndroidToolchain(process.env), ...variantEnv(STORE_VARIANT) };
  const context = { appDir, env };
  const prebuildArgs = ['expo', 'prebuild', '--platform', 'android', '--clean'];
  runStep({ name: 'prebuild', file: 'npx', args: prebuildArgs }, context);
  const gradlew = join('android', 'gradlew');
  runStep(
    { name: 'bundle', file: gradlew, args: ['-p', 'android', ...BUNDLE_RELEASE_ARGS] },
    context,
  );
  const aab = aabPath(appDir);
  console.log(
    `release:android: built ${aab} (versionCode ${String(versionCode)}, sha256 ${sha256Of(aab)})`,
  );
  console.log(
    `release:android: next, the store-AAB gate (android-release-play's check-store-aab.mjs): --aab ${aab} --variant store --ads live --version ${config.version} --build ${String(versionCode)} --game ${options.game} --stamp ${gateStampPath(appDir)} .`,
  );
  console.log(
    `release:android: then, with the owner's word: npm run release:android -- --app ${options.game} --resume upload`,
  );
  return Promise.resolve(0);
}

const fetchHttp: Http = async (request) => {
  const response = await fetch(request.url, {
    method: request.method,
    headers: { ...request.headers },
    body: request.body,
  });
  return { status: response.status, text: await response.text() };
};

function readStamp(path: string): GateStamp | null {
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as GateStamp) : null;
}

async function upload(options: ReleaseAndroidOptions, config: GameValues): Promise<number> {
  const appDir = join('apps', options.game);
  const aab = aabPath(appDir);
  if (!existsSync(aab))
    throw new StopError(`${aab} not found: run the build first (without --resume)`);
  const problems = uploadProblems({
    stamp: readStamp(gateStampPath(appDir)),
    aabSha256: sha256Of(aab),
    versionCode: config.buildNumber,
  });
  if (problems.length > 0) throw new StopError(`nothing was uploaded:\n  ${problems.join('\n  ')}`);
  const account = loadServiceAccount(serviceAccountPathOf(homedir()), process.cwd());
  const client = createPlayClient({
    http: fetchHttp,
    account,
    packageName: config.bundleId,
    nowSeconds: nowEpochSeconds,
  });
  const versionCode = await uploadToInternal(client, readFileSync(aab), options.notes);
  const tag = buildTag(options.game, config.version, versionCode);
  git(['tag', tag]);
  console.log(
    `release:android: versionCode ${String(versionCode)} is on the internal track; tagged ${tag} locally (push only with the owner's word)`,
  );
  return 0;
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(RELEASE_ANDROID_USAGE);
    return 0;
  }
  const options = parseReleaseAndroidArgs(argv);
  const config = await readGame(options.game);
  return options.resume === 'upload' ? upload(options, config) : build(options, config);
}

try {
  process.exitCode = await main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const stop = error instanceof PlayStop ? ' Not retried: send the owner this line and wait.' : '';
  console.error(`release:android: ${message}${stop}`);
  process.exitCode = error instanceof StopError ? 2 : 1;
}
