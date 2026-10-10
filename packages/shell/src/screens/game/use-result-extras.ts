// packages/shell/src/screens/game/use-result-extras.ts
// The values S7 shows that other layers own (game-host-integration's ResultExtras): the daily
// streak after this run, the endless best, and the once-a-day Premium nudge price (spec S7, S12:
// never for owners, never twice on one local day; the day is recorded when the player leaves the
// result, so the line stays on screen while it is shown).
import { useToday } from '@e07/shell/app/use-today.ts';
import { currentDailyStreak } from '@e07/shell/stores/daily-model.ts';
import { premiumNudgePrice } from '@e07/shell/stores/premium/premium-nudge.ts';
import { priceOf } from '@e07/shell/stores/premium/premium-state.ts';
import { usePremiumStore } from '@e07/shell/stores/premium/premium-store.ts';
import {
  selectDaily,
  selectEndlessBest,
  selectProgressDispatch,
} from '@e07/shell/stores/progress-selectors.ts';
import { useProgressStore } from '@e07/shell/stores/progress-store.ts';

import type { ResultExtras } from '@e07/shell/game-host/result-model-of.ts';

export type ResultExtrasModel = ResultExtras & {
  /** Call when the player leaves a result that showed the nudge: today is then used up. */
  readonly markNudgeSeen: () => void;
};

export function useResultExtras(): ResultExtrasModel {
  const today = useToday();
  const daily = useProgressStore(selectDaily);
  const endlessBest = useProgressStore(selectEndlessBest);
  const lastShownOn = useProgressStore((state) => state.upsell.lastShownOn);
  const dispatch = useProgressStore(selectProgressDispatch);
  const isPremium = usePremiumStore((state) => state.isPremium);
  const priceText = usePremiumStore((state) => priceOf(state.flow));
  const nudgePriceText = premiumNudgePrice({ isPremium, priceText, lastShownOn, today });
  return {
    streakDays: currentDailyStreak(daily, today),
    endlessBest,
    nudgePriceText,
    markNudgeSeen: () => {
      if (nudgePriceText !== null) dispatch({ type: 'record-upsell-shown', today });
    },
  };
}
