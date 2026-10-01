// packages/shell/src/config/app-variant.test.ts
import { resolveBuildVariant } from './app-variant.ts';

describe('resolveBuildVariant', () => {
  it('defaults to a test build with test ads when nothing is set', () => {
    expect(resolveBuildVariant({})).toStrictEqual({ appVariant: 'test', adsMode: 'test' });
  });

  it('defaults a store build to live ads', () => {
    const env = { APP_VARIANT: 'store', EXPO_PUBLIC_APP_VARIANT: 'store' };
    expect(resolveBuildVariant(env)).toStrictEqual({ appVariant: 'store', adsMode: 'live' });
  });

  it('rejects a store build whose inlined variant was not set', () => {
    expect(() => resolveBuildVariant({ APP_VARIANT: 'store' })).toThrow(
      'EXPO_PUBLIC_APP_VARIANT=test must equal APP_VARIANT=store',
    );
  });

  it.each([
    ['test', 'live'],
    ['store', 'test'],
  ])('rejects APP_VARIANT=%s with ADS_MODE=%s', (appVariant, adsMode) => {
    const env = { APP_VARIANT: appVariant, EXPO_PUBLIC_APP_VARIANT: appVariant, ADS_MODE: adsMode };
    expect(() => resolveBuildVariant(env)).toThrow('is not allowed');
  });

  it('rejects an unknown variant name', () => {
    expect(() => resolveBuildVariant({ APP_VARIANT: 'prod' })).toThrow('is not one of test|store');
  });
});
