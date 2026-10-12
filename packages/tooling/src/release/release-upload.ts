// packages/tooling/src/release/release-upload.ts
// Release steps 8-12: validate, upload, wait until Apple's processing says VALID, set What to
// Test, tag the build. Every Apple error goes through the playbook (release-failures.ts).
import { execFileSync } from 'node:child_process';

import { ascRequest, type AscResponse } from '@e07/tooling/asc/asc-client.ts';
import { loadAscCredentials } from '@e07/tooling/asc/asc-credentials.ts';
import { ASC_TOKEN_LIFETIME_SECONDS, createAscJwt } from '@e07/tooling/asc/asc-jwt.ts';
import { setWhatsNew } from '@e07/tooling/asc/beta-notes.ts';
import { nowEpochSeconds } from '@e07/tooling/clock/system-clock.ts';
import { sleepMs } from '@e07/tooling/ios/tool-step.ts';
import { buildTag } from '@e07/tooling/release/build-number.ts';
import {
  pollUntilValid,
  processingPollPath,
  reusedToken,
} from '@e07/tooling/release/processing-wait.ts';
import { findDeliveryId } from '@e07/tooling/release/processing.ts';
import { uploadArgs, validateArgs } from '@e07/tooling/release/release-options.ts';
import { runReleaseStep } from '@e07/tooling/release/release-runner.ts';

import type { AscCredentials } from '@e07/tooling/asc/asc-jwt.ts';
import type { ReleaseOptions } from '@e07/tooling/release/release-options.ts';
import type { Preflight } from '@e07/tooling/release/release-preflight.ts';
import type { ReleaseContext } from '@e07/tooling/release/release-runner.ts';

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
  return createAscJwt(loadAscCredentials(env), nowEpochSeconds());
}

const RESUME_PROCESSING =
  'Resume: the upload is done; once the cause is fixed (a 401 or 403 is an owner stop), rerun with --resume processing.';

/** One read of the builds endpoint. Any error keeps the resume hint: the upload must not repeat. */
async function readBuilds(path: string, bearer: string): Promise<unknown> {
  let response: AscResponse;
  try {
    response = await ascRequest(bearer, { method: 'GET', path });
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

/** The key, read once into memory for the whole wait (a missing ID keeps the resume hint). */
function credentialsFor(env: NodeJS.ProcessEnv): AscCredentials {
  try {
    return loadAscCredentials(env);
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`reading the processing state failed: ${reason}\n${RESUME_PROCESSING}`);
  }
}

/**
 * Step 10 (processing-wait.ts): two minutes, then a poll every 60 s for up to an hour with one
 * reused token; returns the build's REST id.
 */
export async function waitUntilValid(
  pre: Preflight,
  buildNumber: number,
  env: NodeJS.ProcessEnv,
): Promise<string> {
  const credentials = credentialsFor(env);
  return pollUntilValid({
    path: processingPollPath(pre.app.appleAppId, buildNumber, pre.app.version),
    read: readBuilds,
    token: reusedToken(
      (now) => createAscJwt(credentials, now),
      nowEpochSeconds,
      ASC_TOKEN_LIFETIME_SECONDS,
    ),
    sleepSeconds: (seconds) => {
      sleepMs(seconds * 1000);
    },
    log: (line) => {
      console.log(line);
    },
  });
}

/**
 * Steps 11-12: What to Test (the text preflight built and checked), then the per-build tag.
 * Returns the tester text for the report; any failure here keeps the resume line.
 */
export type TagInput = {
  readonly options: ReleaseOptions;
  readonly pre: Preflight;
  readonly buildNumber: number;
  readonly restId: string;
};

export async function describeAndTag(input: TagInput, env: NodeJS.ProcessEnv): Promise<string> {
  const { options, pre, buildNumber, restId } = input;
  try {
    await setWhatsNew(token(env), restId, pre.whatToTest);
    execFileSync('git', ['tag', buildTag(options.game, pre.app.version, buildNumber)]);
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `${reason}\nResume: the build is VALID; rerun with --resume processing to set What to Test and tag it.`,
    );
  }
  return pre.whatToTest;
}
