// packages/shell/src/screens/game/use-game-screen-model.ts
// S5's model with S7 inside it: the top bar from topBarPropsOf (undo, and a hint sent only after
// it is paid for) and the result from resultModelOf once the run end is saved (game-host-
// integration). GameScreen (the route) adds navigation, Pause and the board.
import { useServices } from '@e07/shell/app/services-context.tsx';
import { useReduceMotion } from '@e07/shell/app/use-reduce-motion.ts';
import { useGameHost } from '@e07/shell/game-host/game-host-context.tsx';
import { resultModelOf } from '@e07/shell/game-host/result-model-of.ts';
import { topBarPropsOf } from '@e07/shell/game-host/top-bar-model.ts';

import { usePerkPayment } from './use-perk-payment.ts';
import { useResultActions } from './use-result-actions.ts';
import { useResultExtras } from './use-result-extras.ts';
import { useRunText } from './use-run-text.ts';

import type { PerkPayment } from './use-perk-payment.ts';
import type { GameTopBarViewProps } from '@e07/shell/game-host/game-top-bar.tsx';
import type { RunText } from '@e07/shell/game-host/top-bar-model.ts';
import type { GameSessionControls } from '@e07/shell/game-host/use-game-session-controls.ts';
import type { ResultModel } from '@e07/shell/screens/result/result-model.ts';

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
