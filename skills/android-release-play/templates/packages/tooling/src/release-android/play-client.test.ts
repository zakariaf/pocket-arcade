// packages/tooling/src/release-android/play-client.test.ts
import { generateKeyPairSync } from 'node:crypto';

import {
  createPlayClient,
  PLAY_API,
  PLAY_SCOPE,
  PLAY_TOKEN_URL,
  PLAY_UPLOAD_API,
  PlayStop,
  uploadToInternal,
  type HttpRequest,
  type HttpResponse,
} from './play-client.ts';
import { parseServiceAccount } from './play-credentials.ts';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const ACCOUNT = parseServiceAccount(
  JSON.stringify({
    client_email: 'release@e07-play.iam.gserviceaccount.com',
    private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  }),
);
const PACKAGE = 'io.applander.linesiege';
const EDITS = `${PLAY_API}/${PACKAGE}/edits`;
const TOKEN = 'ya29.test-token';

/** A fake Google: answers each call in order and records every request; never the network. */
function fakeGoogle(answers: readonly HttpResponse[]): {
  readonly requests: HttpRequest[];
  readonly http: (request: HttpRequest) => Promise<HttpResponse>;
} {
  const requests: HttpRequest[] = [];
  return {
    requests,
    http: (request) => {
      requests.push(request);
      const answer = answers[requests.length - 1];
      return Promise.resolve(answer ?? { status: 500, text: 'no answer scripted' });
    },
  };
}

const OK_TOKEN = { status: 200, text: JSON.stringify({ access_token: TOKEN, expires_in: 3599 }) };
const OK_EDIT = { status: 200, text: JSON.stringify({ id: 'edit-1' }) };
const OK_BUNDLE = { status: 200, text: JSON.stringify({ versionCode: 10, sha256: 'abc' }) };
const OK_TRACK = { status: 200, text: JSON.stringify({ track: 'internal' }) };
const OK_COMMIT = { status: 200, text: JSON.stringify({ id: 'edit-1' }) };
const client = (http: (request: HttpRequest) => Promise<HttpResponse>) =>
  createPlayClient({
    http,
    account: ACCOUNT,
    packageName: PACKAGE,
    nowSeconds: () => 1_800_000_000,
  });

describe('uploadToInternal', () => {
  it('asks for a token, opens an edit, uploads the bundle, sets the internal track and commits', async () => {
    const google = fakeGoogle([OK_TOKEN, OK_EDIT, OK_BUNDLE, OK_TRACK, OK_COMMIT]);
    const bytes = new Uint8Array([1, 2, 3]);
    await expect(uploadToInternal(client(google.http), bytes, 'First Android build')).resolves.toBe(
      10,
    );
    expect(google.requests.map((request) => `${request.method} ${request.url}`)).toStrictEqual([
      `POST ${PLAY_TOKEN_URL}`,
      `POST ${EDITS}`,
      `POST ${PLAY_UPLOAD_API}/${PACKAGE}/edits/edit-1/bundles?uploadType=media`,
      `PUT ${EDITS}/edit-1/tracks/internal`,
      `POST ${EDITS}/edit-1:commit`,
    ]);
  });

  it('sends a signed JWT bearer assertion for the androidpublisher scope', async () => {
    const google = fakeGoogle([OK_TOKEN, OK_EDIT, OK_BUNDLE, OK_TRACK, OK_COMMIT]);
    await uploadToInternal(client(google.http), new Uint8Array([1]), null);
    const form = new URLSearchParams(String(google.requests[0]?.body));
    expect(form.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer');
    const [header, claims, signature] = (form.get('assertion') ?? '').split('.');
    expect(JSON.parse(Buffer.from(header ?? '', 'base64url').toString())).toStrictEqual({
      alg: 'RS256',
      typ: 'JWT',
    });
    expect(JSON.parse(Buffer.from(claims ?? '', 'base64url').toString())).toStrictEqual({
      iss: 'release@e07-play.iam.gserviceaccount.com',
      scope: PLAY_SCOPE,
      aud: PLAY_TOKEN_URL,
      iat: 1_800_000_000,
      exp: 1_800_003_600,
    });
    expect(signature?.length).toBeGreaterThan(300);
    expect(PLAY_SCOPE.endsWith('.googleapis.com/auth/androidpublisher')).toBe(true);
  });

  it('uploads the bytes as octet-stream with the bearer token', async () => {
    const google = fakeGoogle([OK_TOKEN, OK_EDIT, OK_BUNDLE, OK_TRACK, OK_COMMIT]);
    const bytes = new Uint8Array([7, 8, 9]);
    await uploadToInternal(client(google.http), bytes, null);
    expect(google.requests[2]?.headers).toStrictEqual({
      authorization: `Bearer ${TOKEN}`,
      'content-type': 'application/octet-stream',
    });
    expect(google.requests[2]?.body).toBe(bytes);
  });

  it('releases exactly the uploaded versionCode to internal testers, completed, with the notes', async () => {
    const google = fakeGoogle([OK_TOKEN, OK_EDIT, OK_BUNDLE, OK_TRACK, OK_COMMIT]);
    await uploadToInternal(client(google.http), new Uint8Array([1]), 'Check the daily level');
    expect(JSON.parse(String(google.requests[3]?.body))).toStrictEqual({
      track: 'internal',
      releases: [
        {
          versionCodes: ['10'],
          status: 'completed',
          releaseNotes: [{ language: 'en-US', text: 'Check the daily level' }],
        },
      ],
    });
  });
});

describe('the stops', () => {
  it('stops without a retry on 401 or 403 and never prints the token', async () => {
    const google = fakeGoogle([
      OK_TOKEN,
      { status: 403, text: '{"error":{"status":"PERMISSION_DENIED"}}' },
    ]);
    const run = uploadToInternal(client(google.http), new Uint8Array([1]), null);
    await expect(run).rejects.toThrow(PlayStop);
    await expect(run).rejects.toThrow('permission');
    await expect(run).rejects.not.toThrow(TOKEN);
    expect(google.requests).toHaveLength(2);
  });

  it('names an app the Play Console does not have yet (the first upload is the owner step GP7)', async () => {
    const google = fakeGoogle([
      OK_TOKEN,
      { status: 404, text: '{"error":{"message":"Package not found"}}' },
    ]);
    await expect(uploadToInternal(client(google.http), new Uint8Array([1]), null)).rejects.toThrow(
      'app-not-found',
    );
  });

  it('names a used version code', async () => {
    const used = {
      status: 400,
      text: '{"error":{"message":"APK specifies a version code that has already been used."}}',
    };
    const google = fakeGoogle([OK_TOKEN, OK_EDIT, used]);
    await expect(uploadToInternal(client(google.http), new Uint8Array([1]), null)).rejects.toThrow(
      'version-code-used',
    );
  });

  it('names the API not enabled for the project', async () => {
    const disabled = {
      status: 403,
      text: '{"error":{"message":"Google Play Android Developer API has not been used in project 1 before or it is disabled.","status":"PERMISSION_DENIED","details":[{"reason":"SERVICE_DISABLED"}]}}',
    };
    const google = fakeGoogle([OK_TOKEN, disabled]);
    await expect(uploadToInternal(client(google.http), new Uint8Array([1]), null)).rejects.toThrow(
      'api-not-enabled',
    );
  });
});
