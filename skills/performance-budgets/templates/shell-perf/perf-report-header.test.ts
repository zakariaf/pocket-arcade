// packages/shell/src/app/perf/perf-report-header.test.ts
import { perfReportHeaderOf } from './perf-report-header.ts';

import type { BuildIds } from './perf-report-header.ts';

const IDS: BuildIds = {
  version: '1.0.0',
  ios: { bundleIdentifier: 'io.applander.linesiege', buildNumber: '12' },
  android: { package: 'io.applander.linesiege', versionCode: 12 },
};

describe('perfReportHeaderOf', () => {
  it('reads the Android package and versionCode in an Android build', () => {
    expect(
      perfReportHeaderOf(
        { ...IDS, ios: { bundleIdentifier: 'io.applander.ios-only', buildNumber: '9' } },
        { OS: 'android', Version: 35 },
      ),
    ).toStrictEqual({
      appId: 'io.applander.linesiege',
      appVersion: '1.0.0',
      buildNumber: '12',
      deviceModel: 'android 35',
    });
  });

  it('reads the bundle identifier and build number in an iOS build', () => {
    expect(
      perfReportHeaderOf(
        { ...IDS, android: { package: 'io.applander.android-only', versionCode: 9 } },
        { OS: 'ios', Version: '26.5' },
      ),
    ).toStrictEqual({
      appId: 'io.applander.linesiege',
      appVersion: '1.0.0',
      buildNumber: '12',
      deviceModel: 'ios 26.5',
    });
  });

  it('says unknown for every id the build config lacks', () => {
    expect(perfReportHeaderOf(null, { OS: 'android', Version: 24 })).toStrictEqual({
      appId: 'unknown',
      appVersion: 'unknown',
      buildNumber: 'unknown',
      deviceModel: 'android 24',
    });
    expect(
      perfReportHeaderOf({ version: '1.0.0', android: {} }, { OS: 'android', Version: 35 })
        .buildNumber,
    ).toBe('unknown');
  });
});
