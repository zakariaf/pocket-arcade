// packages/tooling/src/asc/asc-jwt.ts
import { createPrivateKey, sign } from 'node:crypto';

export type AscCredentials = {
  readonly keyId: string;
  readonly issuerId: string;
  readonly privateKeyPem: string;
};

// Apple rejects tokens whose exp is more than 20 minutes after iat.
const TOKEN_LIFETIME_SECONDS = 15 * 60;
const AUDIENCE = 'appstoreconnect-v1';

function toBase64Url(value: string | Uint8Array): string {
  return Buffer.from(value).toString('base64url');
}

export function createAscJwt(credentials: AscCredentials, nowEpochSeconds: number): string {
  const header = { alg: 'ES256', kid: credentials.keyId, typ: 'JWT' };
  const payload = {
    iss: credentials.issuerId,
    iat: nowEpochSeconds,
    exp: nowEpochSeconds + TOKEN_LIFETIME_SECONDS,
    aud: AUDIENCE,
  };
  const signingInput = `${toBase64Url(JSON.stringify(header))}.${toBase64Url(JSON.stringify(payload))}`;
  const signature = sign('sha256', Buffer.from(signingInput), {
    key: createPrivateKey(credentials.privateKeyPem),
    dsaEncoding: 'ieee-p1363',
  });
  return `${signingInput}.${toBase64Url(signature)}`;
}
