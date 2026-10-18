// packages/tooling/src/release/release-upload.ts
// Release steps 8-12: validate, upload, wait until Apple's processing says VALID, set What to
// Test, tag the build. Every Apple error goes through the playbook (release-failures.ts).
import { execFileSync } from 'node:child_process';

import { ascRequest } from '@e07/tooling/asc/asc-client.ts';
import { loadAscCredentials } from '@e07/tooling/asc/asc-credentials.ts';
import { createAscJwt } from '@e07/tooling/asc/asc-jwt.ts';
import { setWhatsNew } from '@e07/tooling/asc/beta-notes.ts';
import { nowEpochSeconds } from '@e07/tooling/clock/system-clock.ts';
import { buildTag } from '@e07/tooling/release/build-number.ts';
import { buildsPath, findDeliveryId, processingStateOf } from '@e07/tooling/release/processing.ts';
import { uploadArgs, validateArgs } from '@e07/tooling/release/release-options.ts';
import { runReleaseStep, sleepSeconds } from '@e07/tooling/release/release-runner.ts';
import { whatToTest } from '@e07/tooling/release/what-to-test.ts';

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

/** Step 10: poll the builds endpoint every 60 s for up to 60 minutes; returns the build's REST id. */
export async function waitUntilValid(
  pre: Preflight,
  buildNumber: number,
  env: NodeJS.ProcessEnv,
): Promise<string> {
  const path = buildsPath(pre.app.appleAppId, buildNumber, pre.app.version);
  for (let attempt = 1; attempt <= POLL_ATTEMPTS; attempt += 1) {
    const response = await ascRequest(token(env), { method: 'GET', path });
    if (!response.ok) {
      throw new Error(
        `App Store Connect answered ${String(response.status)} (${response.errors.map((e) => e.code).join(', ')})`,
      );
    }
    const state = processingStateOf(response.json);
    console.log(
      `release:ios: processing ${state ?? 'not listed yet'} (${String(attempt)}/${String(POLL_ATTEMPTS)})`,
    );
    if (state === 'VALID') {
      const data: unknown = Reflect.get(response.json as object, 'data');
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
    'processing did not reach VALID within 60 minutes: check App Store Connect, then rerun from step 10',
  );
}

function changesSincePreviousBuild(game: string): string[] {
  const tags = execFileSync('git', ['tag', '--list', `${game}/v*+*`, '--sort=-creatordate'], {
    encoding: 'utf8',
  }).split('\n');
  const previous = tags[0]?.trim() ?? '';
  const range = previous === '' ? 'HEAD' : `${previous}..HEAD`;
  const subjects = execFileSync('git', ['log', '--format=%s', range], { encoding: 'utf8' }).split(
    '\n',
  );
  return subjects.filter((subject) => /^(feat|fix)(\(|:)/.test(subject));
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
  const text = whatToTest({
    gameName: pre.app.name,
    version: pre.app.version,
    buildNumber,
    appVariant: options.variant.appVariant,
    changes: changesSincePreviousBuild(options.game),
    focus: options.notes,
    knownIssues: options.knownIssues,
    needsPurchaseTest:
      buildNumber === 1 || options.notes.some((note) => /purchase|premium/i.test(note)),
  });
  await setWhatsNew(token(env), restId, text);
  execFileSync('git', ['tag', buildTag(options.game, pre.app.version, buildNumber)]);
  return text;
}
