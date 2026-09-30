// packages/tooling/src/release/release-upload.ts
// Release steps 8-12: validate, upload, wait until Apple's processing says VALID, set What to
// Test, tag the build. Every Apple error goes through the playbook (release-failures.ts).
import { execFileSync } from 'node:child_process';

import { ascRequest, type AscResponse } from '@e07/tooling/asc/asc-client.ts';
import { loadAscCredentials } from '@e07/tooling/asc/asc-credentials.ts';
import { createAscJwt } from '@e07/tooling/asc/asc-jwt.ts';
import { setWhatsNew } from '@e07/tooling/asc/beta-notes.ts';
import { nowEpochSeconds } from '@e07/tooling/clock/system-clock.ts';
import { buildTag } from '@e07/tooling/release/build-number.ts';
import { buildsPath, findDeliveryId, processingStateOf } from '@e07/tooling/release/processing.ts';
import { uploadArgs, validateArgs } from '@e07/tooling/release/release-options.ts';
import { runReleaseStep, sleepSeconds } from '@e07/tooling/release/release-runner.ts';
import {
  purchaseCheckNeeded,
  summarizeChanges,
  whatToTest,
} from '@e07/tooling/release/what-to-test.ts';

import type { ReleaseOptions } from '@e07/tooling/release/release-options.ts';
import type { Preflight } from '@e07/tooling/release/release-preflight.ts';
import type { ReleaseContext } from '@e07/tooling/release/release-runner.ts';

const POLL_SECONDS = 60;
const POLL_ATTEMPTS = 60;

export type Uploaded = { readonly buildNumber: number; readonly deliveryId: string | null };
export type UploadInput = {
  readonly ipa: string;
  readonly pre: Preflight;
  readonly buildNumber: number;
};

/** Steps 8-9. `--wait` returns when Apple starts PROCESSING; VALID is awaited in step 10. */
export function validateAndUpload(input: UploadInput, context: ReleaseContext): Uploaded {
  const { ipa, pre, buildNumber } = input;
  runReleaseStep('validate', { file: 'xcrun', args: validateArgs(ipa, pre.ids) }, context);
  const meta = {
    appleAppId: pre.app.appleAppId,
    bundleId: pre.app.bundleId,
    buildNumber,
    version: pre.app.version,
  };
  const output = runReleaseStep(
    'upload',
    { file: 'xcrun', args: uploadArgs(ipa, meta, pre.ids) },
    context,
  );
  let json: unknown = null;
  try {
    json = JSON.parse(output);
  } catch {
    json = null;
  }
  return { buildNumber, deliveryId: findDeliveryId(json) };
}

function token(env: NodeJS.ProcessEnv): string {
  // A fresh 15-minute token per request: the wait below can take up to an hour.
  return createAscJwt(loadAscCredentials(env), nowEpochSeconds());
}

const RESUME_PROCESSING =
  'Resume: the upload is done; once the cause is fixed (a 401 or 403 is an owner stop), rerun with --resume processing.';

/** One read of the builds endpoint. Any error keeps the resume hint: the upload must not repeat. */
async function readBuilds(path: string, env: NodeJS.ProcessEnv): Promise<unknown> {
  let response: AscResponse;
  try {
    response = await ascRequest(token(env), { method: 'GET', path });
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`reading the processing state failed: ${reason}\n${RESUME_PROCESSING}`);
  }
  if (!response.ok) {
    const codes = response.errors.map((e) => e.code).join(', ');
    throw new Error(
      `App Store Connect answered ${String(response.status)} (${codes}) while waiting for processing\n${RESUME_PROCESSING}`,
    );
  }
  return response.json;
}

/** Step 10: poll the builds endpoint every 60 s for up to 60 minutes; returns the build's REST id. */
export async function waitUntilValid(
  pre: Preflight,
  buildNumber: number,
  env: NodeJS.ProcessEnv,
): Promise<string> {
  const path = buildsPath(pre.app.appleAppId, buildNumber, pre.app.version);
  for (let attempt = 1; attempt <= POLL_ATTEMPTS; attempt += 1) {
    const json = await readBuilds(path, env);
    const state = processingStateOf(json);
    console.log(
      `release:ios: processing ${state ?? 'not listed yet'} (${String(attempt)}/${String(POLL_ATTEMPTS)})`,
    );
    if (state === 'VALID') {
      const data: unknown = Reflect.get(json as object, 'data');
      const id: unknown = Array.isArray(data) ? Reflect.get(data[0] as object, 'id') : undefined;
      return typeof id === 'string' ? id : '';
    }
    if (state === 'INVALID' || state === 'FAILED') {
      throw new Error(
        `Release stopped: build status ${state}. Owner: forward Apple's email; fix, then rebuild with a new build number.`,
      );
    }
    sleepSeconds(POLL_SECONDS);
  }
  throw new Error(
    'processing did not reach VALID within 60 minutes: check the TestFlight tab in App Store Connect, then rerun with --resume processing',
  );
}

function gitLines(args: readonly string[]): string[] {
  return execFileSync('git', args, { encoding: 'utf8' })
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

/** What changed for this game since its previous build tag ('' = none: the first build). */
function changesSincePreviousBuild(game: string): {
  readonly previousTag: string;
  readonly subjects: readonly string[];
  readonly files: readonly string[];
} {
  const previousTag = gitLines(['tag', '--list', `${game}/v*+*`, '--sort=-creatordate'])[0] ?? '';
  if (previousTag === '') {
    return { previousTag, subjects: [], files: [] };
  }
  // Only what ships in this app: its own folder and the shared packages.
  const paths = ['--', `apps/${game}`, 'packages/shell', 'packages/game-kit'];
  const range = `${previousTag}..HEAD`;
  const subjects = gitLines(['log', '--format=%s', range, ...paths]).filter((subject) =>
    /^(feat|fix)(\(|:)/.test(subject),
  );
  return { previousTag, subjects, files: gitLines(['diff', '--name-only', range]) };
}

/** Steps 11-12: What to Test, then the per-build tag. Returns the tester text for the report. */
export type TagInput = {
  readonly options: ReleaseOptions;
  readonly pre: Preflight;
  readonly buildNumber: number;
  readonly restId: string;
};

export async function describeAndTag(input: TagInput, env: NodeJS.ProcessEnv): Promise<string> {
  const { options, pre, buildNumber, restId } = input;
  const history = changesSincePreviousBuild(options.game);
  const isFirstBuild = history.previousTag === '';
  const text = whatToTest({
    gameName: pre.app.name,
    version: pre.app.version,
    buildNumber,
    appVariant: options.variant.appVariant,
    changes: summarizeChanges(history.subjects, isFirstBuild),
    focus: options.notes,
    knownIssues: options.knownIssues,
    needsPurchaseTest: purchaseCheckNeeded({
      isFirstBuild,
      changedFiles: history.files,
      notes: options.notes,
    }),
  });
  try {
    await setWhatsNew(token(env), restId, text);
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `${reason}\nResume: the build is VALID; rerun with --resume processing to set What to Test and tag it.`,
    );
  }
  execFileSync('git', ['tag', buildTag(options.game, pre.app.version, buildNumber)]);
  return text;
}
