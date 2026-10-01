// packages/shell/src/screens/game/use-game-screen-model.ts (fixture stand-in for toybox-screens'
// model hook: only the L11 part check-game-host reads, the finish for a stranded loss)
import { useEffect, useRef } from 'react';

import { isLossStranded } from '@e07/shell/game-host/run-end-policy.ts';

import type { SessionCommand, SessionView } from '@e07/shell/game-host/session-view.ts';
import type { PerkOffer } from '@e07/shell/services/ads/perk-offer.ts';

/** Once per eventSeq: a lost run nobody can continue is finished, so its recorded Result shows. */
export function useFinishStrandedLoss(
  view: SessionView | null,
  continueOffer: PerkOffer,
  send: (command: SessionCommand) => void,
): void {
  const isStranded = view !== null && isLossStranded(view, continueOffer);
  const finishedFor = useRef<SessionView | null>(null);
  useEffect(() => {
    if (!isStranded || finishedFor.current === view) return;
    finishedFor.current = view;
    send({ type: 'finish' });
  }, [isStranded, send, view]);
}
