// packages/tooling/src/audit/network-pods-layer.test.ts
import { podProblems, trunkPods } from './network-pods-layer.ts';

const LOCK = [
  'PODS:',
  '  - Google-Mobile-Ads-SDK (13.6.0)',
  '',
  'SPEC REPOS:',
  '  trunk:',
  '    - Google-Mobile-Ads-SDK',
  '    - GoogleUserMessagingPlatform',
  '    - openiap',
  '',
  'EXTERNAL SOURCES:',
  '  ExpoModulesCore:',
  '    :path: "../node_modules/expo-modules-core"',
  '',
].join('\n');

describe('vendor pods (layer D)', () => {
  it('reads the trunk pods of a Podfile.lock', () => {
    expect(trunkPods(LOCK)).toStrictEqual([
      'Google-Mobile-Ads-SDK',
      'GoogleUserMessagingPlatform',
      'openiap',
    ]);
    expect(podProblems(LOCK)).toStrictEqual([]);
  });

  it('fails on any trunk pod outside the allowlist', () => {
    const withOnside = LOCK.replace('    - openiap', '    - OnsideKit\n    - openiap');
    expect(podProblems(withOnside)).toStrictEqual([
      'vendor pod OnsideKit is not on the N3 allowlist',
    ]);
  });
});
