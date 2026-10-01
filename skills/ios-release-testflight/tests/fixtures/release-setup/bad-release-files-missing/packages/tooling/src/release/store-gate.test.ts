// packages/tooling/src/release/store-gate.test.ts
import { SAMPLE_APP_ID, storeGateProblems, type ArtifactFacts } from './store-gate.ts';

const STORE = {
  variant: { appVariant: 'store', adsMode: 'live' },
  buildNumber: 8,
  version: '1.0.0',
} as const;
const TEST = {
  variant: { appVariant: 'test', adsMode: 'test' },
  buildNumber: 8,
  version: '1.0.0',
} as const;

const CLEAN_STORE: ArtifactFacts = {
  buildNumber: '8',
  version: '1.0.0',
  usesNonExemptEncryption: false,
  gadAppId: 'ca-app-pub-1234567890123456~1234567890',
  extraAppVariant: 'store',
  extraAdsMode: 'live',
  sentinelCount: 0,
  testArtefacts: [],
  hasPrivacyManifest: true,
  hasGetTaskAllow: false,
  allowsArbitraryLoads: false,
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
});
