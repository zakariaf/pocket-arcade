// packages/tooling/src/release-android/play-client.ts
// The Google Play Android Publisher API v3, called with node's fetch (no npm package): a JWT signed
// by the service account (node:crypto, play-credentials.ts) is exchanged for an access token, then
// one edit uploads the AAB, puts exactly its versionCode on the internal track and commits.
// Release tooling only: the app itself never calls the network (N3). Every non-2xx answer is a
// PlayStop: stop and ask, never retry (401/403, the API not enabled, an app the Console does not
// have yet, a draft app whose first release is the owner's, a used version code, missing policy
// declarations). Errors name the reason, never the token or a header.
import type { ServiceAccount } from '@e07/tooling/release-android/play-credentials.ts';

export const PLAY_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const PLAY_SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
export const PLAY_API = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';
export const PLAY_UPLOAD_API =
  'https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications';

const TOKEN_LIFETIME_SECONDS = 3600;

export type HttpRequest = {
  readonly method: string;
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string | Uint8Array | null;
};
export type HttpResponse = { readonly status: number; readonly text: string };
export type Http = (request: HttpRequest) => Promise<HttpResponse>;

export const PLAY_STOP_REASONS = [
  'auth',
  'api-not-enabled',
  'app-not-found',
  'draft-app',
  'version-code-used',
  'policy-declarations',
  'http-error',
] as const;
export type PlayStopReason = (typeof PLAY_STOP_REASONS)[number];

/** Which call stopped, with its HTTP status. */
export type StopAt = { readonly step: string; readonly status: number };

/** A Play API answer that needs a person: stop, ask the owner, never retry. */
export class PlayStop extends Error {
  readonly reason: PlayStopReason;

  constructor(reason: PlayStopReason, at: StopAt, detail: string) {
    super(`${at.step} stopped: ${reason} (HTTP ${String(at.status)}): ${detail}`);
    this.name = 'PlayStop';
    this.reason = reason;
  }
}

/** Google's error message, never more than a line; the request (and its token) is never quoted. */
function detailOf(text: string): string {
  try {
    const body = JSON.parse(text) as { error?: { message?: string; status?: string } };
    return (body.error?.message ?? body.error?.status ?? 'no message').slice(0, 300);
  } catch {
    return 'an answer that is not JSON';
  }
}

/**
 * A new app stays a draft until its first release is rolled out, and Google refuses a completed
 * release on it (400 "Only releases with status draft may be created on draft app."): the owner's
 * first upload in the Console, owner step GP7. The edit is never committed, so nothing is spent.
 */
const DRAFT_APP_STEP =
  '(the app is still a draft: the owner uploads this AAB once in the Play Console, Testing > Internal testing > Create new release, and rolls it out, owner step GP7; later builds go through the API)';

export function playStopOf(step: string, response: HttpResponse): PlayStop {
  const { status, text } = response;
  const at = { step, status };
  const detail = detailOf(text);
  if (/SERVICE_DISABLED|has not been used in project|is disabled/i.test(text)) {
    return new PlayStop('api-not-enabled', at, detail);
  }
  if (status === 401 || status === 403) {
    return new PlayStop('auth', at, `${detail} (permission or key of the service account)`);
  }
  if (status === 404) return new PlayStop('app-not-found', at, detail);
  if (/status draft may be created on draft app/i.test(text)) {
    return new PlayStop('draft-app', at, `${detail} ${DRAFT_APP_STEP}`);
  }
  if (/version code .*already been used/i.test(text)) {
    return new PlayStop('version-code-used', at, detail);
  }
  if (/declaration|policy/i.test(text)) {
    return new PlayStop('policy-declarations', at, detail);
  }
  return new PlayStop('http-error', at, detail);
}

function base64url(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

/** The service account's JWT bearer assertion for the androidpublisher scope. */
export function serviceJwt(account: ServiceAccount, nowSeconds: number): string {
  const unsigned = `${base64url({ alg: 'RS256', typ: 'JWT' })}.${base64url({
    iss: account.clientEmail,
    scope: PLAY_SCOPE,
    aud: PLAY_TOKEN_URL,
    iat: nowSeconds,
    exp: nowSeconds + TOKEN_LIFETIME_SECONDS,
  })}`;
  return `${unsigned}.${account.signRs256(unsigned)}`;
}

export type PlayClient = {
  readonly packageName: string;
  readonly call: (
    step: string,
    request: Omit<HttpRequest, 'headers'> & { readonly type?: string },
  ) => Promise<unknown>;
};

export function createPlayClient(input: {
  readonly http: Http;
  readonly account: ServiceAccount;
  readonly packageName: string;
  readonly nowSeconds: () => number;
}): PlayClient {
  let token: string | null = null;
  const send = async (step: string, request: HttpRequest): Promise<unknown> => {
    const response = await input.http(request);
    if (response.status < 200 || response.status > 299) throw playStopOf(step, response);
    return JSON.parse(response.text) as unknown;
  };
  const accessToken = async (): Promise<string> => {
    if (token !== null) return token;
    const form = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: serviceJwt(input.account, input.nowSeconds()),
    });
    const answer = (await send('token', {
      method: 'POST',
      url: PLAY_TOKEN_URL,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    })) as { access_token?: string };
    token = answer.access_token ?? '';
    return token;
  };
  return {
    packageName: input.packageName,
    call: async (step, request) => {
      const authorization = `Bearer ${await accessToken()}`;
      const type = request.type ?? 'application/json';
      const { method, url, body } = request;
      return send(step, { method, url, body, headers: { authorization, 'content-type': type } });
    },
  };
}

/**
 * edits.insert -> edits.bundles.upload -> edits.tracks.update (internal, completed) -> edits.commit.
 * Resolves the versionCode Google read from the AAB.
 */
export async function uploadToInternal(
  client: PlayClient,
  bytes: Uint8Array,
  notes: string | null,
): Promise<number> {
  const edits = `${PLAY_API}/${client.packageName}/edits`;
  const edit = (await client.call('edits.insert', { method: 'POST', url: edits, body: null })) as {
    id: string;
  };
  const bundle = (await client.call('edits.bundles.upload', {
    method: 'POST',
    url: `${PLAY_UPLOAD_API}/${client.packageName}/edits/${edit.id}/bundles?uploadType=media`,
    body: bytes,
    type: 'application/octet-stream',
  })) as { versionCode: number };
  const release = {
    versionCodes: [String(bundle.versionCode)],
    status: 'completed',
    ...(notes === null ? {} : { releaseNotes: [{ language: 'en-US', text: notes }] }),
  };
  await client.call('edits.tracks.update', {
    method: 'PUT',
    url: `${edits}/${edit.id}/tracks/internal`,
    body: JSON.stringify({ track: 'internal', releases: [release] }),
  });
  await client.call('edits.commit', {
    method: 'POST',
    url: `${edits}/${edit.id}:commit`,
    body: null,
  });
  return bundle.versionCode;
}
