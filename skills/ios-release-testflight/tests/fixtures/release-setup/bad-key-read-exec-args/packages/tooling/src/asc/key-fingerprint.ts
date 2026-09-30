// Wrong: only asc-credentials.ts reads the key; openssl reading it is a read too.
import { execFileSync } from 'node:child_process';

import { ascKeyPath } from '@e07/tooling/asc/asc-credentials.ts';

export function keyFingerprint(keyId: string): string {
  return execFileSync('openssl', ['pkey', '-in', ascKeyPath(keyId), '-pubout'], {
    encoding: 'utf8',
  });
}
