// packages/shell/src/screens/game/use-hint-button.ts
// Example: a hook that reads three stores the right way and changes state only in a handler.
import { useServices } from '@e07/shell/app/services-context.tsx';
import { useGameExtra } from '@e07/shell/app/use-game-extra.ts';
import { usePremiumStore } from '@e07/shell/stores/premium/premium-store.ts';
import {
  selectFreeHintsLeft,
  selectProgressDispatch,
} from '@e07/shell/stores/progress-selectors.ts';
import { useProgressStore } from '@e07/shell/stores/progress-store.ts';

/** What the S5 hint button shows and does. */
export type HintButton = {
  /** 'free' spends the game's daily free hint; 'ad' offers a rewarded ad; 'premium' is unlimited. */
  readonly source: 'free' | 'ad' | 'premium';
  readonly freeLeft: number;
  /** Call from the button's onPress only (never during render). */
  readonly spendFreeHint: () => void;
};

function sourceOf(isPremium: boolean, freeLeft: number): HintButton['source'] {
  if (isPremium) return 'premium';
  return freeLeft > 0 ? 'free' : 'ad';
}

export function useHintButton(): HintButton {
  const { clock } = useServices();
  const today = clock.today(); // read on every render, never cached
  // The allowance is the game's (game.config.ts hints.freePerDay: 1 with solver hints, 0 without).
  const { freePerDay } = useGameExtra().hints;
  // Primitives and a function reference: no useShallow needed.
  const freeLeft = useProgressStore((state) => selectFreeHintsLeft(state, today, freePerDay));
  const isPremium = usePremiumStore((state) => state.isPremium);
  const dispatch = useProgressStore(selectProgressDispatch);
  return {
    source: sourceOf(isPremium, freeLeft),
    freeLeft,
    spendFreeHint: () => {
      dispatch({ type: 'use-free-hint', today: clock.today(), freePerDay });
    },
  };
}
