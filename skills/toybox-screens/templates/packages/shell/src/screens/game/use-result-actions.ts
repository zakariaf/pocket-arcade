// packages/shell/src/screens/game/use-result-actions.ts
// S7's buttons (spec S7, 8.8, 8.10): Next level, Replay and Try again start the next run inside the
// same Game screen, AFTER a due interstitial (never before the player has seen the result); the
// ad history is saved so the caps survive a kill. Levels and Home record a pending loss (finish)
// and leave. Continue is sent only once it is paid for. One of them runs at a time: a double tap
// while the interstitial is awaited starts one run and saves the ad history once, and while the
// continue is being paid for (the rewarded ad not yet on screen) no other key records or replaces
// the loss the continue is about to rescue (N10).
import { useRef } from 'react';

import { useServices } from '@e07/shell/app/services-context.tsx';
import { useAdContext, useAdPolicyConfig } from '@e07/shell/app/use-ad-context.ts';
import { useGameHost } from '@e07/shell/game-host/game-host-context.tsx';
import { showInterstitialIfDue } from '@e07/shell/services/ads/ad-moments.ts';

import { sendWhenPaid } from './use-perk-payment.ts';

import type { GameSessionControls } from '@e07/shell/game-host/use-game-session-controls.ts';
import type { ResultActions } from '@e07/shell/screens/result/result-model.ts';
import type { LevelOutcome } from '@e07/shell/services/ads/ad-policy.ts';
import type { ErrorLogPort } from '@e07/shell/services/error-log/error-log-port.ts';
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

/** One result action at a time: begin() is false while another one runs. */
type ActionGuard = { readonly begin: () => boolean; readonly end: () => void };

/**
 * Set from the first Next, Replay, Try again, Levels, Home or Continue until its run has started
 * or the continue's payment has settled: the taps that follow (before the screen re-renders, or
 * while an ad covers it) change nothing.
 */
function useActionGuard(): ActionGuard {
  const isBusy = useRef(false);
  return {
    begin: () => {
      if (isBusy.current) return false;
      isBusy.current = true;
      return true;
    },
    end: () => {
      isBusy.current = false;
    },
  };
}

/** Continue: pay first (rewarded ad, or free for Premium), then send it to the run. */
function continueWhenPaid(
  input: ResultActionsInput,
  errorLog: ErrorLogPort,
  guard: ActionGuard,
): () => void {
  const send = (): void => {
    input.controls.send({ type: 'continue' });
  };
  return () => {
    if (!guard.begin()) return;
    sendWhenPaid(() => input.payForContinue().finally(guard.end), send, errorLog);
  };
}

export function useResultActions(input: ResultActionsInput): ResultActions {
  const { controls, nav, onLeaveResult } = input;
  const { errorLog } = useServices();
  const summary = controls.view?.summary ?? null;
  const afterInterstitial = useAfterInterstitial(summary?.isWon === true ? 'win' : 'lose');
  const guard = useActionGuard();
  const startAfterAd = (ref: RunRef): void => {
    if (!guard.begin()) return;
    onLeaveResult();
    afterInterstitial(() => {
      guard.end();
      controls.startRun(ref);
    });
  };
  const leave = (go: () => void) => (): void => {
    if (!guard.begin()) return;
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
    onContinue: continueWhenPaid(input, errorLog, guard),
    onOpenPremium: nav.onOpenPremium,
  };
}
