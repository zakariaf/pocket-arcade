// packages/tooling/src/release-android/play-credentials.test.ts
import { createVerify, generateKeyPairSync } from 'node:crypto';
import { inspect } from 'node:util';

import {
  credentialFileProblems,
  parseServiceAccount,
  serviceAccountPathOf,
} from './play-credentials.ts';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = privateKey.export({ type: 'pkcs8', format: 'pem' });
const MARKER = PEM.split('\n')[1] ?? '';
const EMAIL = 'release@e07-play.iam.gserviceaccount.com';
const ACCOUNT = JSON.stringify({ client_email: EMAIL, private_key: PEM });
const PATH = '/home/owner/.android-keys/play-service-account.json';

/** The text of what `run` throws ('' when it does not throw). */
function errorText(run: () => unknown): string {
  try {
    run();
    return '';
  } catch (error: unknown) {
    return error instanceof Error ? `${error.name}: ${error.message}` : 'not an Error';
  }
}

describe('serviceAccountPathOf', () => {
  it('keeps the JSON key outside the repo, beside the upload keys', () => {
    expect(serviceAccountPathOf('/home/owner')).toBe(PATH);
  });
});

describe('parseServiceAccount', () => {
  it('signs with the key and shows only the account e-mail', () => {
    const account = parseServiceAccount(ACCOUNT);
    expect(account.clientEmail).toBe(EMAIL);
    const verifier = createVerify('RSA-SHA256');
    verifier.update('header.payload');
    expect(verifier.verify(publicKey, account.signRs256('header.payload'), 'base64url')).toBe(true);
  });

  it('keeps the key out of JSON and of an inspection with hidden fields', () => {
    const account = parseServiceAccount(ACCOUNT);
    expect(JSON.stringify(account)).not.toContain(MARKER);
    expect(inspect(account, { showHidden: true })).not.toContain(MARKER);
  });

  it('names a missing field without echoing the file', () => {
    const text = errorText(() => parseServiceAccount(JSON.stringify({ private_key: PEM })));
    expect(text).toBe('Error: the service-account file is not usable: client_email is missing');
  });

  it('reports broken JSON without the parser quoting the key', () => {
    const text = errorText(() => parseServiceAccount(`${ACCOUNT.slice(0, 80)}${MARKER}`));
    expect(text).toBe('Error: the service-account file is not valid JSON');
  });

  it('reports a damaged key without quoting it', () => {
    const damaged = JSON.stringify({ client_email: EMAIL, private_key: MARKER });
    expect(errorText(() => parseServiceAccount(damaged))).toBe(
      'Error: the service-account file is not usable: private_key is not a PEM key',
    );
  });
});

describe('credentialFileProblems', () => {
  it('accepts the file outside the repo with mode 600', () => {
    const stat = { isFile: true, mode: 0o100600 };
    expect(credentialFileProblems({ path: PATH, repoRoot: '/work/e07', stat })).toStrictEqual([]);
  });

  it('refuses a missing file and names the owner step', () => {
    expect(credentialFileProblems({ path: PATH, repoRoot: '/work/e07', stat: null })).toStrictEqual(
      [`no service-account key at ${PATH} (owner step GP3; never paste it into the chat)`],
    );
  });

  it('refuses the file inside the repo or readable by others', () => {
    const inRepo = '/work/e07/play-service-account.json';
    const stat = { isFile: true, mode: 0o100600 };
    expect(credentialFileProblems({ path: inRepo, repoRoot: '/work/e07', stat })).toStrictEqual([
      `the service-account key is inside the repo (${inRepo}): move it to ~/.android-keys/`,
    ]);
    const shared = { isFile: true, mode: 0o100640 };
    expect(
      credentialFileProblems({ path: PATH, repoRoot: '/work/e07', stat: shared }),
    ).toStrictEqual([`${PATH} has mode 640, expected 600: chmod 600 it`]);
  });
});
