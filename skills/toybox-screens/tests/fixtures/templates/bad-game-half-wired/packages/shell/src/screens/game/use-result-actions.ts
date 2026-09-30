// packages/shell/src/screens/game/use-result-actions.ts (planted: Next and Replay skip the due interstitial)
import type { GameSessionControls } from '@e07/shell/game-host/use-game-session-controls.ts';
import type { ResultActions } from '@e07/shell/screens/result/result-model.ts';

export type ResultActionsInput = {
  readonly controls: GameSessionControls;
  readonly nav: { readonly onLevels: () => void; readonly onHome: () => void; readonly onOpenPremium: () => void };
  readonly payForContinue: () => Promise<boolean>;
  readonly onLeaveResult: () => void;
};

export function useResultActions({ controls, nav }: ResultActionsInput): ResultActions {
  const restart = (): void => {
    if (controls.view !== null) controls.startRun(controls.view.ref);
  };
  return {
    onNext: nav.onLevels,
    onReplay: restart,
    onTryAgain: restart,
    onLevels: nav.onLevels,
    onHome: nav.onHome,
    onContinue: () => {
      controls.send({ type: 'continue' });
    },
    onOpenPremium: nav.onOpenPremium,
  };
}
