// packages/tooling/src/asc/asc-credentials.ts
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import type { AscCredentials } from './asc-jwt.ts';

export type ToolEnv = Readonly<Record<string, string | undefined>>;

export function requireEnv(env: ToolEnv, name: string): string {
  const value = env[name];
  if (value === undefined || value === '') {
    throw new Error(
      `${name} is not set. Owner step O3: export it in ~/.zshenv (never in the repo), then start a new shell.`,
    );
  }
  return value;
}

export function ascKeyPath(keyId: string): string {
  return join(homedir(), '.appstoreconnect', 'private_keys', `AuthKey_${keyId}.p8`);
}

// Loads the key into memory only. Never log, print, copy or commit its contents.
export function loadAscCredentials(env: ToolEnv): AscCredentials {
  const keyId = requireEnv(env, 'ASC_KEY_ID');
  return {
    keyId,
    issuerId: requireEnv(env, 'ASC_ISSUER_ID'),
    privateKeyPem: readFileSync(ascKeyPath(keyId), 'utf8'),
  };
}
