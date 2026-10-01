// packages/tooling/src/release/store-gate.test.ts
import {
  appIdOf,
  PLACEHOLDERS,
  SAMPLE_APP_ID,
  storeGateProblems,
  type ArtifactFacts,
} from './store-gate.ts';

const STORE = {
  variant: { appVariant: 'store', adsMode: 'live' },
  buildNumber: 8,
  version: '1.0.0',
  game: 'line-siege',
} as const;
const TEST = {
  variant: { appVariant: 'test', adsMode: 'test' },
  buildNumber: 8,
  version: '1.0.0',
  game: 'line-siege',
} as const;
const EVERYWHERE = { 'Info.plist': true, en: true, de: true, fa: true, ckb: true } as const;

const CLEAN_STORE: ArtifactFacts = {
  buildNumber: '8',
  version: '1.0.0',
  usesNonExemptEncryption: false,
  gadAppId: 'ca-app-pub-7310520968431056~5190264813',
  extraAppVariant: 'store',
  extraAdsMode: 'live',
  sentinelCount: 0,
  placeholderCount: 0,
  testArtefacts: [],
  hasPrivacyManifest: true,
  hasGetTaskAllow: false,
  allowsArbitraryLoads: false,
  bundleId: 'io.applander.linesiege',
  adUnits: ['ca-app-pub-7310520968431056/4417703951'],
  privacyHost: 'games.applander.io',
  supportEmail: 'support@applander.io',
  trackingText: EVERYWHERE,
};

describe('storeGateProblems', () => {
  it('passes a clean store build', () => {
    expect(storeGateProblems(CLEAN_STORE, STORE)).toStrictEqual([]);
  });

  it('catches shipped test code, test artefacts and the sample ad ID in a store build', () => {
    const facts = {
      ...CLEAN_STORE,
      sentinelCount: 1,
      testArtefacts: ['Payload/LineSiege.app/Premium.storekit'],
      gadAppId: SAMPLE_APP_ID,
    };
    expect(storeGateProblems(facts, STORE)).toStrictEqual([
      'GADApplicationIdentifier ca-app-pub-3940256099942544~1458002511 is not a live AdMob app ID',
      'main.jsbundle contains SHELL_TEST_BUILD_ONLY 1 time(s)',
      'test artefact shipped: Payload/LineSiege.app/Premium.storekit',
    ]);
  });

  it('catches a stale build number and a debug entitlement', () => {
    const facts = { ...CLEAN_STORE, buildNumber: '7', hasGetTaskAllow: true };
    expect(storeGateProblems(facts, STORE)).toStrictEqual([
      'CFBundleVersion 7 is not the new build number 8',
      'the get-task-allow entitlement is present (a debug entitlement)',
    ]);
  });

  it('runs only the identity checks on a test build, which keeps its test code', () => {
    const facts = {
      ...CLEAN_STORE,
      extraAppVariant: 'test',
      extraAdsMode: 'test',
      gadAppId: SAMPLE_APP_ID,
      sentinelCount: 3,
    };
    expect(storeGateProblems(facts, TEST)).toStrictEqual([]);
  });

  it('fails a partial Shell in every variant: the placeholder screen never ships', () => {
    const problem =
      'main.jsbundle contains the NotBuiltScreen placeholder (not-built.screen): a partial Shell never ships';
    const facts = { ...CLEAN_STORE, placeholderCount: 2 };
    const testFacts = {
      ...facts,
      extraAppVariant: 'test',
      extraAdsMode: 'test',
      gadAppId: SAMPLE_APP_ID,
    };
    expect(storeGateProblems(facts, STORE)).toStrictEqual([problem]);
    expect(storeGateProblems(testFacts, TEST)).toStrictEqual([problem]);
  });
});

describe('app ids, placeholders and the tracking text (owner decisions O1 and O4)', () => {
  it('pins the placeholder list the gates refuse by name', () => {
    expect(PLACEHOLDERS).toStrictEqual({
      bundleIdPrefix: 'com.example.',
      admobAppId: 'ca-app-pub-1234567890123456~1234567890',
      admobUnits: [
        'ca-app-pub-1234567890123456/1111111111',
        'ca-app-pub-1234567890123456/2222222222',
        'ca-app-pub-1234567890123456/3333333333',
      ],
      privacyHost: 'example.com',
      supportEmail: 'support@example.com',
    });
  });

  it('names the app id io.applander.<game id without hyphens>', () => {
    expect([appIdOf('line-siege'), appIdOf('tap-flip')]).toStrictEqual([
      'io.applander.linesiege',
      'io.applander.tapflip',
    ]);
  });

  it("refuses com.example.* and another game's id in every variant", () => {
    const placeholder = { ...CLEAN_STORE, bundleId: 'com.example.linesiege' };
    expect(storeGateProblems(placeholder, STORE)).toStrictEqual([
      "CFBundleIdentifier com.example.linesiege is the scaffold's placeholder (com.example.*)",
    ]);
    const other = {
      ...CLEAN_STORE,
      extraAppVariant: 'test',
      extraAdsMode: 'test',
      gadAppId: SAMPLE_APP_ID,
    };
    expect(storeGateProblems({ ...other, bundleId: 'io.applander.tapflip' }, TEST)).toStrictEqual([
      'CFBundleIdentifier io.applander.tapflip is not io.applander.linesiege',
    ]);
  });

  it('refuses the placeholder AdMob app id and units, and the example.com links', () => {
    const facts = {
      ...CLEAN_STORE,
      gadAppId: PLACEHOLDERS.admobAppId,
      adUnits: ['ca-app-pub-1234567890123456/3333333333'],
      privacyHost: 'example.com',
      supportEmail: 'support@example.com',
    };
    expect(storeGateProblems(facts, STORE)).toStrictEqual([
      'GADApplicationIdentifier ca-app-pub-1234567890123456~1234567890 is the placeholder AdMob app id (owner step G5)',
      'extra.adUnits holds the placeholder AdMob unit ca-app-pub-1234567890123456/3333333333 (owner step G5)',
      'extra.game.links holds the placeholder privacy-policy host example.com',
      'extra.game.links holds the placeholder support address support@example.com',
    ]);
  });

  it('needs the tracking prompt text in Info.plist and in en, de, fa and ckb', () => {
    const facts = {
      ...CLEAN_STORE,
      trackingText: { ...EVERYWHERE, 'Info.plist': false, fa: false },
    };
    expect(storeGateProblems(facts, STORE)).toStrictEqual([
      'Info.plist has no NSUserTrackingUsageDescription (the tracking prompt would crash the app)',
      'fa.lproj/InfoPlist.strings has no NSUserTrackingUsageDescription',
    ]);
  });
});
