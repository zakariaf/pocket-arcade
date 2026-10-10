// packages/shell/src/screens/game/use-game-screen-model.ts
// S5's model with S7 inside it: the top bar from topBarPropsOf (undo, and a hint sent only after
// it is paid for) and the result from resultModelOf once the run end is saved (game-host-
// integration). A lost run whose continue nobody can give is finished at once (L11, never strand a
// finished run), so its recorded Result shows. GameScreen (the route) adds navigation, Pause and
// the board.
import { useLayoutEffect, useRef } from 'react';

import { useServices } from '@e07/shell/app/services-context.tsx';
import { useReduceMotion } from '@e07/shell/app/use-reduce-motion.ts';
import { useGameHost } from '@e07/shell/game-host/game-host-context.tsx';
import { resultModelOf } from '@e07/shell/game-host/result-model-of.ts';
import { isLossStranded } from '@e07/shell/game-host/run-end-policy.ts';
import { topBarPropsOf } from '@e07/shell/game-host/top-bar-model.ts';

import { usePerkPayment } from './use-perk-payment.ts';
import { useResultActions } from './use-result-actions.ts';
import { useResultExtras } from './use-result-extras.ts';
import { useRunText } from './use-run-text.ts';

import type { PerkPayment } from './use-perk-payment.ts';
import type { GameTopBarViewProps } from '@e07/shell/game-host/game-top-bar.tsx';
import type { SessionView } from '@e07/shell/game-host/session-view.ts';
import type { RunText } from '@e07/shell/game-host/top-bar-model.ts';
import type { GameSessionControls } from '@e07/shell/game-host/use-game-session-controls.ts';
import type { ResultModel } from '@e07/shell/screens/result/result-model.ts';
import type { PerkOffer } from '@e07/shell/services/ads/perk-offer.ts';

export type GameScreenNav = {
  /** popTo('Levels') after the run is recorded. */
  readonly onLevels: () => void;
  /** popTo('Home'). */
  readonly onHome: () => void;
  /** navigate('Premium') from the result's nudge. */
  readonly onOpenPremium: () => void;
};

export type GameScreenModel = {
  /**
   * null while there is no run to show (status 'missing'). No hint key for a game without solver
   * hints (GameHost.hasHints false), whatever the perk offer says.
   */
  readonly topBar: GameTopBarViewProps | null;
  /** null while the run is live and for the tutorial. */
  readonly result: ResultModel | null;
};

type TopBarInput = {
  readonly controls: GameSessionControls;
  readonly perks: PerkPayment;
  readonly text: RunText;
  /** GameHost.hasHints: the game has solver hints (the one fact behind the hint key). */
  readonly hasHints: boolean;
  readonly isReducedMotion: boolean;
};

/** Sends a paid perk to the run only once the payment resolved true. */
function sendWhenPaid(pay: () => Promise<boolean>, send: () => void, report: (e: unknown) => void) {
  pay()
    .then((isPaid) => {
      if (isPaid) send();
    })
    .catch(report);
}

function useTopBar({
  controls,
  perks,
  text,
  hasHints,
  isReducedMotion,
}: TopBarInput): GameTopBarViewProps | null {
  const { errorLog } = useServices();
  const { view } = controls;
  if (view === null) return null;
  const report = (error: unknown): void => {
    errorLog.record('ads', error);
  };
  const props = topBarPropsOf({
    view,
    hintOffer: perks.hintOffer,
    text,
    labels: {
      undo: text.t('game-screen.undo-button.a11y-label'),
      hint: text.t('game-screen.hint-button.a11y-label'),
    },
    isReducedMotion,
    onUndo: () => {
      controls.send({ type: 'undo' });
    },
    onHint: () => {
      sendWhenPaid(
        perks.payForHint,
        () => {
          controls.send({ type: 'hint' });
        },
        report,
      );
    },
    onPause: controls.pause,
  });
  return { ...props, hint: hasHints ? props.hint : null, hasHints };
}

/**
 * L11: a lost run whose continue offer is 'hidden' (ads off, offline, no rewarded ad that can come,
 * no Premium) waits for nobody, so it is finished once per eventSeq of the run: the run end is
 * recorded (statistics, streak, endless best, ad history) and the recorded Result follows, the
 * endless result with its score and New best or the lose result without the offer. The same holds
 * when a shown offer turns hidden (offline, a load error) and for a pending loss reopened from
 * Home. 'loading' keeps the offer (drawn busy). A layout effect, so the recorded Result replaces
 * the pending one before the frame is shown.
 */
function useFinishStrandedLoss(controls: GameSessionControls, continueOffer: PerkOffer): void {
  const { view, send } = controls;
  const isStranded = view !== null && isLossStranded(view, continueOffer);
  // The view a finish was sent for: a new run, or a new eventSeq, is always a new view object.
  const finishedFor = useRef<SessionView | null>(null);
  // Allowed effect: records the run end in the session (an external store) the view follows.
  useLayoutEffect(() => {
    if (!isStranded || finishedFor.current === view) return;
    finishedFor.current = view;
    send({ type: 'finish' });
  }, [isStranded, view, send]);
}

export function useGameScreenModel(
  controls: GameSessionControls,
  nav: GameScreenNav,
): GameScreenModel {
  const text = useRunText();
  const game = useGameHost();
  const isReducedMotion = useReduceMotion();
  const perks = usePerkPayment(controls.view);
  const extras = useResultExtras();
  const actions = useResultActions({
    controls,
    nav,
    payForContinue: perks.payForContinue,
    onLeaveResult: extras.markNudgeSeen,
  });
  const topBar = useTopBar({ controls, perks, text, hasHints: game.hasHints, isReducedMotion });
  useFinishStrandedLoss(controls, perks.continueOffer);
  const { view } = controls;
  if (view === null) return { topBar, result: null };
  const { continueOffer } = perks;
  const result = resultModelOf({
    view,
    game,
    text,
    actions,
    continueOffer,
    isReducedMotion,
    extras,
  });
  return { topBar, result };
}
