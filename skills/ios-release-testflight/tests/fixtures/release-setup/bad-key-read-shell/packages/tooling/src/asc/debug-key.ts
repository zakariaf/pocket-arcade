import { execSync } from 'node:child_process';

export function showKey(keyId: string): string {
  return execSync(`cat ~/.appstoreconnect/private_keys/AuthKey_${keyId}.p8`, { encoding: 'utf8' });
}
