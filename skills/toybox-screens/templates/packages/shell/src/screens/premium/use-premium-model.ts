// packages/shell/src/screens/premium/use-premium-model.ts
// S12's model hook: the premium store through useShallow, the service and game name from the
// composition root, navigation, and reduce motion. It also announces each restore toast to
// VoiceOver and clears the one-off notices ("Thank you!", "Purchase restored") after NOTICE_MS.
// A parity capture (test builds) opens its S12 card like a player: Buy once as soon as the price
// is there (the parity store answers purchasing, pending, purchased or failed), the four restore
// outcomes stacked on the restore card, and the thank-you page held while it is captured.
import { useNavigation } from '@react-navigation/native';
import { useEffect, useEffectEvent, useState } from 'react';
import { useShallow } from 'zustand/shallow';

import { usePremiumScreenDeps } from '@e07/shell/app/premium-screen-deps-context.tsx';
import { TEST_ONLY } from '@e07/shell/app/test-only.ts';
import { useAnnounce } from '@e07/shell/app/use-announce.ts';
import { useReduceMotion } from '@e07/shell/app/use-reduce-motion.ts';
import { gameMessageText } from '@e07/shell/i18n/game-message-text.ts';
import { useT } from '@e07/shell/i18n/t-context.ts';
import { usePremiumStore } from '@e07/shell/stores/premium/premium-store.ts';

import { premiumModelOf } from './premium-model-of.ts';
import { premiumToastFor } from './premium-toasts.ts';

import type { PremiumModel } from './premium-model.ts';
import type { PremiumAction } from '@e07/shell/stores/premium/premium-state.ts';
import type { PremiumView } from '@e07/shell/stores/premium/premium-view.ts';

/** How long the thank-you page and the "Purchase restored" toast stay (Chosen: about 3 s). */
export const NOTICE_MS = 3000;

const THANKS_SHOWN: PremiumAction = { type: 'thanks-shown' };
const RESTORE_NOTICE_SHOWN: PremiumAction = { type: 'restore-notice-shown' };

/** After NOTICE_MS, tell the store the one-off notice was seen, so it never shows twice. */
function useClearNotice(
  isShown: boolean,
  send: (action: PremiumAction) => void,
  action: PremiumAction,
): void {
  useEffect(() => {
    if (!isShown) return undefined;
    const timer = setTimeout(() => {
      send(action);
    }, NOTICE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [isShown, send, action]);
}

/** Speaks each new restore toast once (a toast's alert role alone is not announced on iOS). */
function useAnnounceToast(text: string | null): void {
  const announce = useAnnounce();
  const onToast = useEffectEvent((toastText: string) => {
    announce(toastText);
  });
  useEffect(() => {
    if (text !== null) onToast(text);
  }, [text]);
}

/** The S12 parity cards that draw what the store answers after one Buy. */
const BUY_FRAME_STATES: ReadonlySet<string> = new Set([
  'premium-purchasing',
  'premium-pending-approval',
  'premium-success',
  'premium-error',
]);

/** Test builds: on a purchase card, press Buy once, when the price has loaded (view 'ready'). */
function useParityBuy(frameState: string | null, view: PremiumView, onBuy: () => void): void {
  const pressBuy = useEffectEvent(onBuy);
  const isDue = frameState !== null && BUY_FRAME_STATES.has(frameState) && view === 'ready';
  useEffect(() => {
    if (isDue) pressBuy();
  }, [isDue]);
}

export function usePremiumModel(): PremiumModel {
  const [frameState] = useState(() => TEST_ONLY?.parityFrameState() ?? null);
  const t = useT();
  const deps = usePremiumScreenDeps();
  const navigation = useNavigation();
  const state = usePremiumStore(
    useShallow((s) => ({
      isPremium: s.isPremium,
      didJustPurchase: s.didJustPurchase,
      didJustRestore: s.didJustRestore,
      flow: s.flow,
    })),
  );
  const model = premiumModelOf({
    state,
    service: deps.service,
    gameName: gameMessageText(t, deps.gameName),
    isReducedMotion: useReduceMotion(),
    onBack: () => {
      navigation.goBack();
    },
  });
  const toast = premiumToastFor(model.view, model.hasJustRestored);
  useAnnounceToast(toast === null ? null : t(toast.textKey));
  useParityBuy(frameState, model.view, model.onBuy);
  // A captured card holds its notice; a normal launch clears it after NOTICE_MS.
  const isHeld = frameState !== null;
  useClearNotice(model.view === 'success' && !isHeld, deps.service.dispatch, THANKS_SHOWN);
  useClearNotice(model.hasJustRestored && !isHeld, deps.service.dispatch, RESTORE_NOTICE_SHOWN);
  return { ...model, isRestoreToastStack: frameState === 'premium-restore-toasts' };
}
