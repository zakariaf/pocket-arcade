// packages/shell/src/screens/home/use-home-model.ts
// S4's model hook, the only Home code that reads stores, services, the host and navigation:
//   game look and words  useGameHost(): logo, nameId, taglineId (through gameMessageText)
//   Play / Continue      useLevelPlay(): save.doc().run?.ref of kind 'level', else the next level
//                        (the level count from useGameExtra())
//   endless              useGameExtra().modes.endless and the progress store's best
//   daily card           useDailySummary() (daily-and-statistics) and the Shell date formatter
//   banner               useBannerSlot('home') (admob-ads: Premium, online, consent, tutorial, levels)
//   cold start           useColdStartMark(perf log of a test build's debug services, else null)
//   parity frame         s14-progress-restored opens the "Progress restored" dialog over Home
import { useOptionalDebugServices } from '@e07/shell/app/debug-services-context.tsx';
import { useOpenDialog } from '@e07/shell/app/dialog-context.tsx';
import { useColdStartMark } from '@e07/shell/app/perf/use-cold-start-mark.ts';
import { useBannerSlot } from '@e07/shell/app/use-ad-context.ts';
import { useGameExtra } from '@e07/shell/app/use-game-extra.ts';
import { useParityOpener } from '@e07/shell/app/use-parity-opener.ts';
import { useReduceMotion } from '@e07/shell/app/use-reduce-motion.ts';
import { useGameHost } from '@e07/shell/game-host/game-host-context.tsx';
import { formatWeekdayDayMonth } from '@e07/shell/i18n/format-date.ts';
import { gameMessageText } from '@e07/shell/i18n/game-message-text.ts';
import { useT } from '@e07/shell/i18n/t-context.ts';
import { useDailySummary } from '@e07/shell/screens/daily/use-daily-summary.ts';
import { usePremiumStore } from '@e07/shell/stores/premium/premium-store.ts';
import { selectEndlessBest } from '@e07/shell/stores/progress-selectors.ts';
import { useProgressStore } from '@e07/shell/stores/progress-store.ts';

import { useHomeActions } from './use-home-actions.ts';
import { useLevelPlay } from './use-level-play.ts';

import type { HomeModel } from './home-model.ts';

/**
 * Home's first frame with real data ends the cold start (store builds have no debug services and
 * mark nothing); a parity capture of s14-progress-restored opens that dialog over Home.
 */
function useHomeMoments(): void {
  useColdStartMark(useOptionalDebugServices()?.perfLog ?? null);
  const openDialog = useOpenDialog();
  useParityOpener('save-restored-dialog', () => {
    openDialog({ kind: 'save-restored' });
  });
}

export function useHomeModel(): HomeModel {
  useHomeMoments();
  const t = useT();
  const host = useGameHost();
  const { onPlay, ...play } = useLevelPlay();
  const daily = useDailySummary();
  return {
    logo: host.logo,
    gameName: gameMessageText(t, { id: host.nameId }),
    tagline: gameMessageText(t, { id: host.taglineId }),
    hasEndless: useGameExtra().modes.endless,
    isPremium: usePremiumStore((state) => state.isPremium),
    isReducedMotion: useReduceMotion(),
    play,
    daily: {
      dateText: formatWeekdayDayMonth(daily.today, t),
      streakDays: daily.currentStreak,
      isDoneToday: daily.isDone,
    },
    bestEndlessScore: useProgressStore(selectEndlessBest),
    banner: useBannerSlot('home'),
    actions: useHomeActions(onPlay, daily.today),
  };
}
