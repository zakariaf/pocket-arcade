// packages/tooling/src/audit/network-app-layers.test.ts
import { podAndConfigProblems } from './network-app-layers.ts';

const LOCK = [
  'PODS:',
  '  - openiap (1.0.0)',
  '',
  'SPEC REPOS:',
  '  trunk:',
  '    - openiap',
  '    - OnsideKit',
  '',
].join('\n');
const UPDATES_ON = { updates: { enabled: true }, plugins: ['expo-iap'] };

describe('the pods (D) and config (E) layers of one app', () => {
  it('runs the config layer even before a prebuild, when there is no ios/Podfile.lock', () => {
    expect(podAndConfigProblems({ podfileLock: null, config: UPDATES_ON })).toStrictEqual([
      'SKIPPED pods layer: no ios/Podfile.lock (run npx expo prebuild first)',
      'expo.updates.enabled must be false',
    ]);
  });

  it('runs both layers after a prebuild', () => {
    expect(podAndConfigProblems({ podfileLock: LOCK, config: UPDATES_ON })).toStrictEqual([
      'vendor pod OnsideKit is not on the N3 allowlist',
      'expo.updates.enabled must be false',
    ]);
  });
});
