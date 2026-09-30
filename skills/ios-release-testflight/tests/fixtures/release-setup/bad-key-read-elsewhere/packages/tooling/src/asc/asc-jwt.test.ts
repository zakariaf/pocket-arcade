// packages/tooling/src/asc/asc-jwt.test.ts
// Uses a throwaway P-256 key generated in the test; the real .p8 is never read by tests.
import { generateKeyPairSync, verify } from 'node:crypto';

import { createAscJwt } from './asc-jwt.ts';
import { localizationsPath, patchWhatsNewBody, findEnglishLocalization } from './beta-notes.ts';

function decodePart(part: string | undefined): unknown {
  return JSON.parse(Buffer.from(part ?? '', 'base64url').toString('utf8'));
}

describe('createAscJwt', () => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const token = createAscJwt(
    { keyId: 'KEY123', issuerId: 'ISSUER', privateKeyPem: pem },
    1_000_000,
  );
  const [header, payload, signature] = token.split('.');

  it('writes the ES256 header and a payload that expires in under 20 minutes', () => {
    expect(decodePart(header)).toStrictEqual({ alg: 'ES256', kid: 'KEY123', typ: 'JWT' });
    expect(decodePart(payload)).toStrictEqual({
      iss: 'ISSUER',
      iat: 1_000_000,
      exp: 1_000_900,
      aud: 'appstoreconnect-v1',
    });
  });

  it('signs verifiably with the key (IEEE P1363 encoding)', () => {
    const isValid = verify(
      'sha256',
      Buffer.from(`${header ?? ''}.${payload ?? ''}`),
      { key: publicKey, dsaEncoding: 'ieee-p1363' },
      Buffer.from(signature ?? '', 'base64url'),
    );
    expect(isValid).toBe(true);
  });
});

describe('beta notes payloads', () => {
  it('addresses the build and patches whatsNew', () => {
    expect(localizationsPath('b-1')).toBe('/v1/builds/b-1/betaBuildLocalizations');
    // App Store Connect resource type names are camelCase, so the body is compared as JSON text.
    expect(JSON.stringify(patchWhatsNewBody('loc-1', 'text'))).toBe(
      '{"data":{"type":"betaBuildLocalizations","id":"loc-1","attributes":{"whatsNew":"text"}}}',
    );
  });

  it('finds the en-US localization', () => {
    const json = {
      data: [
        { id: 'de', attributes: { locale: 'de-DE' } },
        { id: 'en', attributes: { locale: 'en-US' } },
      ],
    };
    expect(findEnglishLocalization(json)).toStrictEqual({ id: 'en', locale: 'en-US' });
  });
});
