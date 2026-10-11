// packages/shell/src/screens/premium/use-unseen-restore-outcome.ts
// S12's rule for a restore that ended while the page was closed (from the S11 Restore purchase row,
// or on an earlier visit): its toast belongs where the restore ended, so S12 opens without it. The
// outcome found on opening is left out of what S12 draws and reads out from the first render, and
// the premium store clears it (restore-outcome-cleared). A restore that ends while S12 is open
// shows as before, and a parity capture keeps the outcome its card holds.
import { useEffect, useEffectEvent, useState } from 'react';

import { premiumNotice } from '@e07/shell/stores/premium/premium-notice.ts';
import { premiumReducer } from '@e07/shell/stores/premium/premium-reducer.ts';

import type { PremiumAction, PremiumState } from '@e07/shell/stores/premium/premium-state.ts';

const OUTCOME_CLEARED: PremiumAction = { type: 'restore-outcome-cleared' };

/** "Purchase restored", "nothing to restore" or "couldn't restore": a restore that has ended. */
function hasRestoreOutcome(state: PremiumState): boolean {
  const notice = premiumNotice(state);
  return notice !== null && notice !== 'restoring';
}

/** The premium state S12 draws: without the restore outcome it found on opening. */
export function useUnseenRestoreOutcome(
  state: PremiumState,
  send: (action: PremiumAction) => void,
  isHeld: boolean,
): PremiumState {
  // The flow that outcome came with: every later restore brings a new flow object.
  const [unseenFlow] = useState(() => (!isHeld && hasRestoreOutcome(state) ? state.flow : null));
  const clearUnseen = useEffectEvent(() => {
    if (unseenFlow !== null) send(OUTCOME_CLEARED);
  });
  // Allowed effect: on opening, hands the premium store (outside React) the outcome S12 never saw.
  useEffect(() => {
    clearUnseen();
  }, []);
  return state.flow === unseenFlow ? premiumReducer(state, OUTCOME_CLEARED) : state;
}
