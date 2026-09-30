// packages/tooling/src/audit/license-policy.test.ts
import { isAllowedLicense, licenseProblems, packageRootOf } from './license-policy.ts';

describe('isAllowedLicense', () => {
  it('accepts an OR expression with one allowed side', () => {
    expect(isAllowedLicense('(BSD-3-Clause OR GPL-2.0)')).toBe(true);
  });

  it('rejects a copyleft licence', () => {
    expect(isAllowedLicense('MPL-2.0')).toBe(false);
  });

  it('requires both sides of an AND expression', () => {
    expect(isAllowedLicense('MIT AND CC-BY-4.0')).toBe(false);
  });
});

describe('packageRootOf', () => {
  it('finds a scoped package root', () => {
    expect(packageRootOf('../../node_modules/@formatjs/intl/lib/x.js')).toBe(
      '../../node_modules/@formatjs/intl',
    );
  });

  it('returns null for our own sources', () => {
    expect(packageRootOf('packages/shell/src/ui/app-text.tsx')).toBeNull();
  });
});

describe('licenseProblems', () => {
  it('accepts an excepted licence only when the exception names that licence', () => {
    const licenses = new Map([['caniuse-lite', 'CC-BY-4.0']]);
    const exceptions = { 'caniuse-lite': { license: 'CC-BY-4.0', reason: 'data only' } };
    expect(licenseProblems(licenses, exceptions)).toStrictEqual([]);
  });

  it('reports a package without a licence field', () => {
    expect(licenseProblems(new Map([['mystery', null]]), {})).toStrictEqual([
      'mystery: licence "null" is not allowed and has no exception entry',
    ]);
  });
});
