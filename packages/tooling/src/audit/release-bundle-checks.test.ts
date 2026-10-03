// packages/tooling/src/audit/release-bundle-checks.test.ts
import { storeBundleProblems } from './release-bundle-checks.ts';

const SAMPLE = 'ca-app-pub-3940256099942544/2435281174';

describe('storeBundleProblems (release audit, JS half)', () => {
  it("allows Google's sample IDs only inside the AdMob library", () => {
    const library = {
      source: '../../node_modules/react-native-google-mobile-ads/src/TestIds.ts',
      content: SAMPLE,
    };
    expect(storeBundleProblems([library])).toStrictEqual([]);
    const ours = { source: '../../packages/shell/src/services/ads/units.ts', content: SAMPLE };
    expect(storeBundleProblems([ours])).toHaveLength(1);
  });

  it('flags test-only code, StoreKit test code and debug screens', () => {
    const problems = storeBundleProblems([
      { source: 'packages/shell/src/app/test-only-entry.ts', content: "'SHELL_TEST_BUILD_ONLY'" },
      { source: 'packages/shell/src/app/harness.ts', content: 'SKTestSession' },
      { source: 'packages/shell/src/screens/debug/debug-screen.tsx', content: 'null' },
    ]);
    expect(problems).toHaveLength(3);
  });
});
