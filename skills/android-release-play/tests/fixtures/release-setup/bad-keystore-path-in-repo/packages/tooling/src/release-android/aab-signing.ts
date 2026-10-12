// packages/tooling/src/release-android/aab-signing.ts
// The upload key (Play App Signing: Google holds the app-signing key, this key only proves the
// upload is ours). It lives outside the repo at ~/.android-keys/<game>-upload.jks with mode 600,
// and its passwords live in ~/.gradle/gradle.properties under names of this game only, which Gradle
// reads by itself: no tooling ever opens, prints, copies or logs the key or a password. Here only
// the path, the property names and the file's stat are handled.
import { join, relative } from 'node:path';

export const UPLOAD_KEY_ALIAS = 'upload';

export type SigningPropertyNames = {
  readonly storeFile: string;
  readonly storePassword: string;
  readonly keyAlias: string;
  readonly keyPassword: string;
};

/** The parts of fs.statSync the checks need; null when the file does not exist. */
export type KeyStat = { readonly isFile: boolean; readonly mode: number };

export function uploadKeyPathOf(game: string, home: string): string {
  return join(home, 'keys', `${game}-upload.jks`);
}

/** E07_<GAME>_UPLOAD_*: the release build's signing config reads these Gradle properties. */
export function signingPropertyNames(game: string): SigningPropertyNames {
  const prefix = `E07_${game.toUpperCase().replaceAll('-', '_')}_UPLOAD_`;
  return {
    storeFile: `${prefix}STORE_FILE`,
    storePassword: `${prefix}STORE_PASSWORD`,
    keyAlias: `${prefix}KEY_ALIAS`,
    keyPassword: `${prefix}KEY_PASSWORD`,
  };
}

export type SecretFile = {
  readonly path: string;
  readonly repoRoot: string;
  readonly stat: KeyStat | null;
};

/**
 * A secret file (the upload key, the service-account JSON) sits outside the repo, exists, and is
 * readable by its owner only; judged from its stat, never by opening it.
 */
export function secretFileProblems(
  file: SecretFile,
  words: { readonly what: string; readonly missing: string },
): string[] {
  const inside = relative(file.repoRoot, file.path);
  if (!inside.startsWith('..') && !inside.startsWith('/')) {
    return [`the ${words.what} is inside the repo (${file.path}): move it to ~/.android-keys/`];
  }
  if (file.stat?.isFile !== true) return [`no ${words.what} at ${file.path} (${words.missing})`];
  const mode = file.stat.mode & 0o777;
  return mode === 0o600
    ? []
    : [`${file.path} has mode ${mode.toString(8)}, expected 600: chmod 600 it`];
}

/** Where the upload key is and who can read it, from its stat only. */
export function keystoreProblems(file: SecretFile): string[] {
  return secretFileProblems(file, {
    what: 'upload key',
    missing: 'owner step GP2: Claude generates it with keytool, or the owner provides one',
  });
}

/**
 * keytool arguments for a new upload key (decision c of the Android plan). The passwords come
 * from two environment variables of that one process (`-storepass:env`), never the command line.
 */
export function keytoolGenerateArgs(keyPath: string): string[] {
  return [
    ...['-genkeypair', '-keystore', keyPath, '-alias', UPLOAD_KEY_ALIAS],
    ...['-keyalg', 'RSA', '-keysize', '4096', '-validity', '10000'],
    ...['-dname', 'CN=Applander Upload, O=Applander'],
    ...['-storepass:env', 'E07_UPLOAD_STORE_PASSWORD', '-keypass:env', 'E07_UPLOAD_KEY_PASSWORD'],
  ];
}
