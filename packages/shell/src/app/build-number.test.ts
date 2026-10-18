// packages/shell/src/app/build-number.test.ts
import { buildNumberOf } from './build-number.ts';

// Spec S11 (the version line) and the perf report's header: one build number per platform.
describe('buildNumberOf', () => {
  const config = { ios: { buildNumber: '8' }, android: { versionCode: 9 } };

  it("reads iOS's buildNumber, and Android's versionCode on Android", () => {
    expect([buildNumberOf(config, 'ios'), buildNumberOf(config, 'android')]).toStrictEqual([
      '8',
      '9',
    ]);
  });

  it('is undefined when the config lacks the platform’s number', () => {
    expect([
      buildNumberOf({ ios: { buildNumber: '8' } }, 'android'),
      buildNumberOf({ android: { versionCode: 9 } }, 'ios'),
      buildNumberOf(undefined, 'android'),
    ]).toStrictEqual([undefined, undefined, undefined]);
  });
});
