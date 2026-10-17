// packages/tooling/src/release-android/release-android-plan.test.ts
import {
  aabPath,
  BUNDLE_RELEASE_ARGS,
  gateStampPath,
  ownerStepsOf,
  parseReleaseAndroidArgs,
  preflightProblems,
  RELEASE_ANDROID_USAGE,
  uploadProblems,
  type ReleaseState,
} from './release-android-plan.ts';

const READY: ReleaseState = {
  branch: 'main',
  isTreeClean: true,
  isVerifyGreen: true,
  hasShellSlice: false,
  ownerStepsPending: [],
};

describe('parseReleaseAndroidArgs', () => {
  it('releases to the internal track by default', () => {
    expect(parseReleaseAndroidArgs(['--app', 'line-siege'])).toStrictEqual({
      game: 'line-siege',
      track: 'internal',
      resume: null,
      notes: null,
    });
  });

  it('takes --resume upload and release notes', () => {
    const options = parseReleaseAndroidArgs([
      ...['--app', 'line-siege', '--resume', 'upload', '--notes', 'First Android build'],
    ]);
    expect(options.resume).toBe('upload');
    expect(options.notes).toBe('First Android build');
  });

  it("refuses any track but internal: promotion is the owner's", () => {
    expect(() => parseReleaseAndroidArgs(['--app', 'line-siege', '--track', 'production'])).toThrow(
      "promotion is the owner's",
    );
  });

  it('refuses a missing game and prints the usage', () => {
    expect(() => parseReleaseAndroidArgs(['--track', 'internal'])).toThrow(RELEASE_ANDROID_USAGE);
  });
});

describe('preflightProblems', () => {
  it('lets a clean main with a green verify and no owner step pending through', () => {
    expect(preflightProblems(READY)).toStrictEqual([]);
  });

  it('refuses a dirty tree', () => {
    expect(preflightProblems({ ...READY, isTreeClean: false })).toStrictEqual([
      'the working tree is not clean: commit or stash first (the release commits the build number)',
    ]);
  });

  it('refuses a branch other than main', () => {
    expect(preflightProblems({ ...READY, branch: 'epic/e18-android-port' })).toStrictEqual([
      'releases come from main, this is epic/e18-android-port',
    ]);
  });

  it('refuses a red verify', () => {
    expect(preflightProblems({ ...READY, isVerifyGreen: false })).toStrictEqual([
      'npm run verify is not green on this commit',
    ]);
  });

  it('refuses an owner placeholder and names the steps still pending', () => {
    expect(preflightProblems({ ...READY, ownerStepsPending: ['G3', 'GP5'] })).toStrictEqual([
      'owner steps pending: G3, GP5 (the store build would carry placeholders)',
    ]);
  });

  it('refuses a partial Shell', () => {
    expect(preflightProblems({ ...READY, hasShellSlice: true })).toStrictEqual([
      'shell-slice.json exists: a partial Shell never ships',
    ]);
  });
});

describe('uploadProblems', () => {
  const STAMP = { result: 'PASS', sha256: 'abc', versionCode: 10, isUnsigned: false };

  it('lets an AAB through whose store-AAB gate passed on these exact bytes', () => {
    expect(uploadProblems({ stamp: STAMP, aabSha256: 'abc', versionCode: 10 })).toStrictEqual([]);
  });

  it('refuses an AAB the gate never checked', () => {
    expect(uploadProblems({ stamp: null, aabSha256: 'abc', versionCode: 10 })).toStrictEqual([
      'no store-AAB gate stamp: run check-store-aab.mjs with --stamp first',
    ]);
  });

  it('refuses an AAB that changed after the gate, or a rehearsal stamp', () => {
    expect(uploadProblems({ stamp: STAMP, aabSha256: 'def', versionCode: 10 })).toStrictEqual([
      'the AAB changed after the gate (sha256 differs): run check-store-aab.mjs again',
    ]);
    expect(
      uploadProblems({ stamp: { ...STAMP, isUnsigned: true }, aabSha256: 'abc', versionCode: 10 }),
    ).toStrictEqual(['the stamp is from a keyless rehearsal, never release evidence']);
    expect(
      uploadProblems({ stamp: { ...STAMP, result: 'FAIL' }, aabSha256: 'abc', versionCode: 10 }),
    ).toStrictEqual(['the store-AAB gate did not pass: fix every FAIL line first']);
  });

  it('refuses a stamp for another versionCode', () => {
    expect(uploadProblems({ stamp: STAMP, aabSha256: 'abc', versionCode: 11 })).toStrictEqual([
      'the gate checked versionCode 10, this release is 11',
    ]);
  });
});

describe('paths and commands', () => {
  it('builds the Play bundle and finds it where Gradle writes it', () => {
    expect(BUNDLE_RELEASE_ARGS).toStrictEqual(['bundleRelease', '--console=plain']);
    expect(aabPath('apps/line-siege')).toBe(
      'apps/line-siege/android/app/build/outputs/bundle/release/app-release.aab',
    );
    expect(gateStampPath('apps/line-siege')).toBe('apps/line-siege/build/release/aab-gate.json');
  });
});

describe('ownerStepsOf', () => {
  const OWNER_VALUES = {
    ads: {
      isEnabled: true,
      ids: {
        android: {
          appId: 'ca-app-pub-1111222233334444~5555666677',
          units: {
            banner: 'ca-app-pub-1111222233334444/1000000001',
            interstitial: 'ca-app-pub-1111222233334444/1000000002',
            rewarded: 'ca-app-pub-1111222233334444/1000000003',
          },
        },
      },
    },
    links: { privacyPolicy: { host: 'applander.io' }, supportEmail: 'support@applander.io' },
  };

  it('finds nothing pending once the owner supplied the links and the Android AdMob ids', () => {
    expect(ownerStepsOf(OWNER_VALUES)).toStrictEqual([]);
  });

  it('names G3 for the scaffold links and GP5 for missing Android AdMob ids', () => {
    expect(
      ownerStepsOf({
        ads: { isEnabled: true, ids: { android: null } },
        links: { privacyPolicy: { host: 'example.com' }, supportEmail: 'support@example.com' },
      }),
    ).toStrictEqual(['G3', 'GP5']);
  });

  it('names GP5 for a scaffold placeholder in the Android ids', () => {
    const placeholder = {
      ...OWNER_VALUES,
      ads: {
        isEnabled: true,
        ids: {
          android: {
            ...OWNER_VALUES.ads.ids.android,
            appId: 'ca-app-pub-1234567890123456~1234567890',
          },
        },
      },
    };
    expect(ownerStepsOf(placeholder)).toStrictEqual(['GP5']);
  });

  it("names GP5 for Google's test ids typed into the Android ids: a live build shows test ads", () => {
    const sample = {
      ...OWNER_VALUES,
      ads: {
        isEnabled: true,
        ids: {
          android: {
            appId: 'ca-app-pub-3940256099942544~3347511713',
            units: {
              banner: 'ca-app-pub-3940256099942544/6300978111',
              interstitial: 'ca-app-pub-3940256099942544/1033173712',
              rewarded: 'ca-app-pub-3940256099942544/5224354917',
            },
          },
        },
      },
    };
    expect(ownerStepsOf(sample)).toStrictEqual(['GP5']);
  });

  it('needs no Android ids for a game without ads', () => {
    expect(
      ownerStepsOf({ ...OWNER_VALUES, ads: { isEnabled: false, ids: { android: null } } }),
    ).toStrictEqual([]);
  });
});
