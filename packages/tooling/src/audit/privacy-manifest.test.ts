// packages/tooling/src/audit/privacy-manifest.test.ts
import {
  appTrackingProblems,
  mergeReasons,
  missingReasons,
  trackingAnswers,
} from './privacy-manifest.ts';

const GMA = {
  NSPrivacyAccessedAPITypes: [
    {
      NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime',
      NSPrivacyAccessedAPITypeReasons: ['35F9.1'],
    },
    {
      NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace',
      NSPrivacyAccessedAPITypeReasons: ['E174.1'],
    },
  ],
};
const UMP = {
  NSPrivacyAccessedAPITypes: [
    {
      NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
      NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
    },
  ],
};

describe('privacy manifest aggregation', () => {
  it('merges the reasons of every pod', () => {
    const merged = mergeReasons([GMA, UMP]);
    expect([...merged.keys()]).toHaveLength(3);
    expect(merged.get('NSPrivacyAccessedAPICategoryDiskSpace')).toStrictEqual(new Set(['E174.1']));
  });

  it('lists every pod reason the app manifest lacks', () => {
    const app = mergeReasons([GMA]);
    expect(missingReasons(mergeReasons([GMA, UMP]), app)).toStrictEqual([
      'NSPrivacyAccessedAPICategoryUserDefaults CA92.1',
    ]);
  });
});

describe('App Tracking Transparency facts (owner decision O1)', () => {
  it("keeps the app's own manifest free of tracking: false, and no tracking domains", () => {
    expect(appTrackingProblems({ NSPrivacyTracking: false })).toStrictEqual([]);
    expect(
      appTrackingProblems({ NSPrivacyTracking: true, NSPrivacyTrackingDomains: ['x.example'] }),
    ).toStrictEqual([
      'the app manifest must set NSPrivacyTracking: false',
      'the app manifest must list no NSPrivacyTrackingDomains',
    ]);
  });

  it('answers App Privacy for the Device ID the ads SDK uses for tracking', () => {
    const deviceId = {
      NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeDeviceID',
      NSPrivacyCollectedDataTypeLinked: true,
      NSPrivacyCollectedDataTypeTracking: true,
    };
    const crash = {
      ...deviceId,
      NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeCrashData',
    };
    const answers = trackingAnswers([
      { pod: 'Google-Mobile-Ads-SDK', item: deviceId },
      {
        pod: 'Google-Mobile-Ads-SDK',
        item: { ...crash, NSPrivacyCollectedDataTypeTracking: false },
      },
    ]);
    expect(answers).toStrictEqual([
      'App Privacy: DeviceID collected, linked to the user, used for tracking by the third-party ads SDK Google-Mobile-Ads-SDK (the app asks App Tracking Transparency first)',
    ]);
  });
});
