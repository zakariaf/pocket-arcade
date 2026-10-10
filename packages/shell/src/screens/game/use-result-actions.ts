// packages/shell/src/screens/game/use-result-actions.ts
// S7's buttons (spec S7, 8.8, 8.10): Next level, Replay and Try again start the next run inside the
// same Game screen, AFTER a due interstitial (never before the player has seen the result); the
// ad history is saved so the caps survive a kill. Levels and Home record a pending loss (finish)
// and leave. Continue is sent only once it is paid for.
import { useServices } from '@e07/shell/app/services-context.tsx';
import { useAdContext, useAdPolicyConfig } from '@e07/shell/app/use-ad-context.ts';
import { useGameHost } from '@e07/shell/game-host/game-host-context.tsx';
import { showInterstitialIfDue } from '@e07/shell/services/ads/ad-moments.ts';

import type { GameSessionControls } from '@e07/shell/game-host/use-game-session-controls.ts';
import type { ResultActions } from '@e07/shell/screens/result/result-model.ts';
import type { LevelOutcome } from '@e07/shell/services/ads/ad-policy.ts';
import type { RunRef } from '@e07/shell/services/save/schema/save-doc.ts';

export type ResultActionsInput = {
  readonly controls: GameSessionControls;
  readonly nav: {
    readonly onLevels: () => void;
    readonly onHome: () => void;
    readonly onOpenPremium: () => void;
  };
  readonly payForContinue: () => Promise<boolean>;
  /** Runs whenever the player leaves the result (the nudge's day is used up then). */
  readonly onLeaveResult: () => void;
};

/** Shows a due interstitial, saves the new ad history, then always runs `then`. */
function useAfterInterstitial(outcome: LevelOutcome): (then: () => void) => void {
  const { ads, save, clock, errorLog } = useServices();
  const { lifecycle } = useGameHost();
  const config = useAdPolicyConfig('result');
  const context = useAdContext('result');
  return (then) => {
    const history = save.doc().ads.history;
    const trigger = { outcome, nowMs: clock.nowMs() };
    const showIfDue = async (): Promise<void> => {
      const next = await showInterstitialIfDue(
        { ads, lifecycle },
        { config, context, history, trigger },
      );
      if (next !== history) save.update((doc) => ({ ...doc, ads: { ...doc.ads, history: next } }));
    };
    showIfDue()
      .catch((error: unknown) => {
        errorLog.record('ads', error);
      })
      .finally(then);
  };
}

/** Continue: pay first (rewarded ad, or free for Premium), then send it to the run. */
function continueWhenPaid(input: ResultActionsInput, report: (error: unknown) => void): () => void {
  return () => {
    input
      .payForContinue()
      .then((isPaid) => {
        if (isPaid) input.controls.send({ type: 'continue' });
      })
      .catch(report);
  };
}

export function useResultActions(input: ResultActionsInput): ResultActions {
  const { controls, nav, onLeaveResult } = input;
  const { errorLog } = useServices();
  const summary = controls.view?.summary ?? null;
  const afterInterstitial = useAfterInterstitial(summary?.isWon === true ? 'win' : 'lose');
  const startAfterAd = (ref: RunRef): void => {
    onLeaveResult();
    afterInterstitial(() => {
      controls.startRun(ref);
    });
  };
  const leave = (go: () => void) => (): void => {
    onLeaveResult();
    controls.send({ type: 'finish' });
    go();
  };
  const restart = (): void => {
    if (controls.view !== null) startAfterAd(controls.view.ref);
  };
  const next = summary?.nextLevel ?? null;
  return {
    onNext:
      next === null
        ? leave(nav.onLevels)
        : () => {
            startAfterAd({ kind: 'level', level: next });
          },
    onReplay: restart,
    onTryAgain: restart,
    onLevels: leave(nav.onLevels),
    onHome: leave(nav.onHome),
    onContinue: continueWhenPaid(input, (error) => {
      errorLog.record('ads', error);
    }),
    onOpenPremium: nav.onOpenPremium,
  };
}
