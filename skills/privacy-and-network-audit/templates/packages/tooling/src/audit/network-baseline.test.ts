// packages/tooling/src/audit/network-baseline.test.ts
import { addFinding, compareToBaseline } from './network-baseline.ts';

import type { Baseline } from './network-baseline.ts';

const BASELINE: Baseline = {
  'react-native': { categories: ['webSocket', 'remoteUrl'], reason: 'RN core; unused by our code' },
  'whatwg-fetch': { categories: ['fetch', 'xhr'], reason: 'polyfill; unused by our code' },
};

describe('compareToBaseline', () => {
  it('passes findings the baseline explains', () => {
    const findings = new Map<string, Set<string>>();
    addFinding(findings, 'react-native', 'webSocket');
    addFinding(findings, 'whatwg-fetch', 'fetch');
    expect(compareToBaseline(findings, BASELINE)).toStrictEqual([]);
  });

  it('reports a new category, a new package and a stale entry', () => {
    const findings = new Map<string, Set<string>>();
    addFinding(findings, 'react-native', 'fetch');
    addFinding(findings, 'left-pad', 'remoteUrl');
    expect(compareToBaseline(findings, BASELINE)).toStrictEqual([
      'NEW react-native: fetch (not in baseline)',
      'NEW left-pad: remoteUrl (not in baseline)',
      'STALE whatwg-fetch: in baseline but not found',
    ]);
  });
});
