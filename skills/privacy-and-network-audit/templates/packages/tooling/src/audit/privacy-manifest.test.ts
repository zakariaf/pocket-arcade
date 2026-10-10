// packages/tooling/src/audit/privacy-manifest.test.ts
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import {
  appTrackingProblems,
  localPodManifestPaths,
  mergeReasons,
  missingReasons,
  podspecPrivacyFiles,
  privacyProblems,
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

describe("development pods' manifests (built from a local :path or :podspec)", () => {
  it('reads the privacy manifests a podspec bundles, in any platform or subspec', () => {
    const podspec = {
      resource_bundles: { Kit: [], Kit_privacy: ['PrivacyInfo.xcprivacy'] },
      ios: { resources: 'ios/Other.bundle' },
      subspecs: [{ name: 'Core', resource_bundles: { Core: 'Core/PrivacyInfo.xcprivacy' } }],
    };
    expect(podspecPrivacyFiles(podspec)).toStrictEqual([
      'PrivacyInfo.xcprivacy',
      'Core/PrivacyInfo.xcprivacy',
    ]);
    expect(podspecPrivacyFiles({ name: 'NoResources' })).toStrictEqual([]);
  });

  let repo = '';
  const write = (path: string, text: string): void => {
    mkdirSync(dirname(join(repo, path)), { recursive: true });
    writeFileSync(join(repo, path), text);
  };

  beforeEach(() => {
    repo = realpathSync(mkdtempSync(join(tmpdir(), 'privacy-pods-')));
    const lock = [
      'PODS:',
      '  - LocalKit (1.0.0)',
      '',
      'EXTERNAL SOURCES:',
      '  ExpoFileSystem:',
      '    :podspec: "../../../node_modules/expo-file-system/ios/ExpoFileSystem.podspec"',
      '  LocalKit:',
      '    :path: "../../../node_modules/local-kit/ios"',
      '  NoManifest:',
      '    :path: "../../../node_modules/no-manifest"',
      '',
      'SPEC CHECKSUMS:',
      '  LocalKit: 0000',
      '',
    ].join('\n');
    write('apps/game/ios/Podfile.lock', lock);
    const specs = 'apps/game/ios/Pods/Local Podspecs';
    const bundle = (name: string): string =>
      JSON.stringify({
        name,
        resource_bundles: { [`${name}_privacy`]: ['PrivacyInfo.xcprivacy'] },
      });
    write(`${specs}/LocalKit.podspec.json`, bundle('LocalKit'));
    write(`${specs}/ExpoFileSystem.podspec.json`, bundle('ExpoFileSystem'));
    write(`${specs}/NoManifest.podspec.json`, JSON.stringify({ name: 'NoManifest' }));
    write('node_modules/local-kit/ios/PrivacyInfo.xcprivacy', '<plist/>');
    write('node_modules/expo-file-system/ios/PrivacyInfo.xcprivacy', '<plist/>');
  });

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true });
  });

  it('finds the manifests CocoaPods bundles from each local pod, next to the trunk pods', () => {
    expect(localPodManifestPaths(join(repo, 'apps/game/ios'))).toStrictEqual([
      {
        pod: 'ExpoFileSystem',
        path: join(repo, 'node_modules/expo-file-system/ios/PrivacyInfo.xcprivacy'),
      },
      { pod: 'LocalKit', path: join(repo, 'node_modules/local-kit/ios/PrivacyInfo.xcprivacy') },
    ]);
  });

  const globPod = (folder: string, podspec: object): void => {
    const lock = [
      'PODS:',
      '',
      'EXTERNAL SOURCES:',
      '  GlobKit:',
      `    :path: "../../../${folder}"`,
      '',
    ];
    write('apps/game/ios/Podfile.lock', lock.join('\n'));
    write('apps/game/ios/Pods/Local Podspecs/GlobKit.podspec.json', JSON.stringify(podspec));
  };

  it('expands resource globs from the pod root as CocoaPods does, keeping PrivacyInfo.xcprivacy', () => {
    for (const file of [
      'ios/Resources/PrivacyInfo.xcprivacy',
      'ios/Resources/icon.png',
      'PrivacyInfo.xcprivacy',
      'Kit.bundle/Info.plist',
      'ios/Deep/Nested/PrivacyInfo.xcprivacy',
    ])
      write(`node_modules/glob-kit/${file}`, '<plist/>');
    globPod('node_modules/glob-kit', {
      name: 'GlobKit',
      resource_bundles: { GlobKit_privacy: ['ios/Resources/*'] },
      resources: '*.{xcprivacy,bundle}',
      ios: { resource_bundles: { Deep: 'ios/**/*.xcprivacy' } },
    });
    const kit = join(repo, 'node_modules/glob-kit');
    expect(localPodManifestPaths(join(repo, 'apps/game/ios'))).toStrictEqual([
      { pod: 'GlobKit', path: join(kit, 'ios/Resources/PrivacyInfo.xcprivacy') },
      { pod: 'GlobKit', path: join(kit, 'PrivacyInfo.xcprivacy') },
      { pod: 'GlobKit', path: join(kit, 'ios/Deep/Nested/PrivacyInfo.xcprivacy') },
    ]);
  });

  it('fails naming the pod when a resource glob cannot be expanded', () => {
    globPod('node_modules/missing-kit', { name: 'GlobKit', resources: ['ios/*'] });
    expect(() => localPodManifestPaths(join(repo, 'apps/game/ios'))).toThrow(
      'pod GlobKit: cannot expand the resource pattern "ios/*" (its folder',
    );
    expect(() => podspecPrivacyFiles({ resources: 'ios/*' })).toThrow(
      'pod (unknown): cannot expand the resource pattern "ios/*" (no pod folder given)',
    );
  });

  it('fails on a reason only a local pod declares, and on tracking outside the AdMob pods', () => {
    const diskSpace = {
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace',
          NSPrivacyAccessedAPITypeReasons: ['E174.1', '85F4.1'],
        },
      ],
    };
    const pods = [
      { pod: 'Google-Mobile-Ads-SDK', path: 'Pods/Google-Mobile-Ads-SDK/x', manifest: GMA },
      { pod: 'ExpoFileSystem', path: 'node_modules/fs/x', manifest: diskSpace },
      { pod: 'LocalKit', path: 'node_modules/local-kit/x', manifest: { NSPrivacyTracking: true } },
    ];
    const app = { NSPrivacyTracking: false, ...GMA };
    expect(privacyProblems(pods, app)).toStrictEqual([
      'app.config lacks NSPrivacyAccessedAPICategoryDiskSpace 85F4.1',
      'tracking declared outside the AdMob pods: LocalKit (node_modules/local-kit/x)',
    ]);
    expect(privacyProblems(pods.slice(0, 1), app)).toStrictEqual([]);
  });
});
