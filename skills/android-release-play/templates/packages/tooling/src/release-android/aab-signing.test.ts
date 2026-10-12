// packages/tooling/src/release-android/aab-signing.test.ts
import {
  keystoreProblems,
  keytoolGenerateArgs,
  signingPropertyNames,
  uploadKeyPathOf,
  UPLOAD_KEY_ALIAS,
} from './aab-signing.ts';

const KEY = '/home/owner/.android-keys/line-siege-upload.jks';

describe('uploadKeyPathOf', () => {
  it('keeps the upload key outside the repo, one per game', () => {
    expect(uploadKeyPathOf('line-siege', '/home/owner')).toBe(KEY);
  });
});

describe('signingPropertyNames', () => {
  it("names the game's own Gradle properties, so no other project signs with them", () => {
    expect(signingPropertyNames('line-siege')).toStrictEqual({
      storeFile: 'E07_LINE_SIEGE_UPLOAD_STORE_FILE',
      storePassword: 'E07_LINE_SIEGE_UPLOAD_STORE_PASSWORD',
      keyAlias: 'E07_LINE_SIEGE_UPLOAD_KEY_ALIAS',
      keyPassword: 'E07_LINE_SIEGE_UPLOAD_KEY_PASSWORD',
    });
  });
});

describe('keystoreProblems', () => {
  const OWN = { isFile: true, mode: 0o100600 };

  it('accepts the key outside the repo, readable by its owner only', () => {
    expect(keystoreProblems({ path: KEY, repoRoot: '/work/e07', stat: OWN })).toStrictEqual([]);
  });

  it('refuses a key inside the repo', () => {
    expect(
      keystoreProblems({ path: '/work/e07/keys/upload.jks', repoRoot: '/work/e07', stat: OWN }),
    ).toStrictEqual([
      'the upload key is inside the repo (/work/e07/keys/upload.jks): move it to ~/.android-keys/',
    ]);
  });

  it('refuses a missing key and names the owner step', () => {
    expect(keystoreProblems({ path: KEY, repoRoot: '/work/e07', stat: null })).toStrictEqual([
      `no upload key at ${KEY} (owner step GP2: Claude generates it with keytool, or the owner provides one)`,
    ]);
  });

  it('refuses a key other users can read', () => {
    expect(
      keystoreProblems({
        path: KEY,
        repoRoot: '/work/e07',
        stat: { isFile: true, mode: 0o100644 },
      }),
    ).toStrictEqual([`${KEY} has mode 644, expected 600: chmod 600 it`]);
  });
});

describe('keytoolGenerateArgs', () => {
  it('generates a 4096-bit RSA upload key with the passwords read from the environment', () => {
    const args = keytoolGenerateArgs(KEY);
    expect(args).toStrictEqual([
      ...['-genkeypair', '-keystore', KEY, '-alias', UPLOAD_KEY_ALIAS],
      ...['-keyalg', 'RSA', '-keysize', '4096', '-validity', '10000'],
      ...['-dname', 'CN=Applander Upload, O=Applander'],
      ...['-storepass:env', 'E07_UPLOAD_STORE_PASSWORD', '-keypass:env', 'E07_UPLOAD_KEY_PASSWORD'],
    ]);
  });
});
