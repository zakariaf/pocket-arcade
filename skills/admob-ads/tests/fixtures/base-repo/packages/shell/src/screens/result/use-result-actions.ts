// packages/shell/src/screens/result/use-result-actions.ts (fixture)
import { useEffect } from 'react';

import { showInterstitialIfDue } from '@e07/shell/services/ads/ad-moments.ts';

import type { AdMomentDeps } from '@e07/shell/services/ads/ad-moments.ts';
import type { AdHistory, InterstitialRequest } from '@e07/shell/services/ads/ad-policy.ts';

type Options = {
  readonly deps: AdMomentDeps;
  readonly request: InterstitialRequest;
  readonly saveHistory: (history: AdHistory) => void;
  readonly goNext: () => void;
  readonly announce: () => void;
};

export function useResultActions({ deps, request, saveHistory, goNext, announce }: Options) {
  useEffect(() => {
    announce();
  }, [announce]);
  const handleNextPress = async (): Promise<void> => {
    saveHistory(await showInterstitialIfDue(deps, request));
    goNext();
  };
  return { handleNextPress };
}
