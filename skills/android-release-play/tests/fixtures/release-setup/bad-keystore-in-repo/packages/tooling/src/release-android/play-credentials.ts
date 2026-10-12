// packages/tooling/src/release-android/play-credentials.ts
// The Google Play service-account key is handled like App Store Connect's .p8: only this module
// reads it, only into memory, and the private key never leaves the signing closure. Nothing here
// can print it: the object holds the account e-mail and a sign function, and every error is our
// own sentence, never the parser's (V8 quotes the input in JSON errors).
import { createPrivateKey, createSign, type KeyObject } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  secretFileProblems,
  type KeyStat,
  type SecretFile,
} from '@e07/tooling/release-android/aab-signing.ts';

export type ServiceAccount = {
  readonly clientEmail: string;
  /** RS256 signature of `data`, base64url: the key itself is never exposed. */
  readonly signRs256: (data: string) => string;
};

export function serviceAccountPathOf(home: string): string {
  return join(home, '.android-keys', 'play-service-account.json');
}

function fieldOf(json: Readonly<Record<string, unknown>>, name: string): string {
  const value = json[name];
  if (typeof value !== 'string' || value === '') {
    throw new Error(`the service-account file is not usable: ${name} is missing`);
  }
  return value;
}

function keyOf(pem: string): KeyObject {
  try {
    return createPrivateKey(pem);
  } catch {
    throw new Error('the service-account file is not usable: private_key is not a PEM key');
  }
}

/** Parses the JSON key file's text into an account that can sign, nothing more. */
export function parseServiceAccount(text: string): ServiceAccount {
  let json: Readonly<Record<string, unknown>>;
  try {
    json = JSON.parse(text) as Readonly<Record<string, unknown>>;
  } catch {
    throw new Error('the service-account file is not valid JSON');
  }
  const clientEmail = fieldOf(json, 'client_email');
  const key = keyOf(fieldOf(json, 'private_key'));
  const signRs256 = (data: string): string => {
    const signer = createSign('RSA-SHA256');
    signer.update(data);
    return signer.sign(key, 'base64url');
  };
  return Object.freeze({ clientEmail, signRs256 });
}

/** Where the service-account key is and who can read it (owner step GP3), from its stat only. */
export function credentialFileProblems(file: SecretFile): string[] {
  return secretFileProblems(file, {
    what: 'service-account key',
    missing: 'owner step GP3; never paste it into the chat',
  });
}

function statOf(path: string): KeyStat | null {
  try {
    const stat = statSync(path);
    return { isFile: stat.isFile(), mode: stat.mode };
  } catch {
    return null;
  }
}

/** The one read of the key file: checked first, parsed into memory, never logged. */
export function loadServiceAccount(path: string, repoRoot: string): ServiceAccount {
  const problems = credentialFileProblems({ path, repoRoot, stat: statOf(path) });
  if (problems.length > 0) throw new Error(problems.join('; '));
  return parseServiceAccount(readFileSync(path, 'utf8'));
}
