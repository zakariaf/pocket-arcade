// packages/tooling/src/audit/privacy-manifest.test.ts
import { mergeReasons, missingReasons } from './privacy-manifest.ts';

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
