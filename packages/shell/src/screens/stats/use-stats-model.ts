// packages/shell/src/screens/stats/use-stats-model.ts
// S10's model hook: useStatsSummary() (daily-and-statistics) over the game's shape (the level
// count and Endless from useGameExtra(), the counters from useGameHost().counters with their
// labels), the numbers in the chosen digits, the banner through useBannerSlot('stats'), the
// reset-statistics dialog, and the empty state's Play key (Home's, through useLevelPlay()).
import { useNavigation } from '@react-navigation/native';

import { useOpenDialog } from '@e07/shell/app/dialog-context.tsx';
import { useBannerSlot } from '@e07/shell/app/use-ad-context.ts';
import { levelCountOf, useGameExtra } from '@e07/shell/app/use-game-extra.ts';
import { useReduceMotion } from '@e07/shell/app/use-reduce-motion.ts';
import { useGameHost } from '@e07/shell/game-host/game-host-context.tsx';
import {
  createNumberFormatter,
  createPercentFormatter,
} from '@e07/shell/i18n/create-number-formatter.ts';
import { localeTagFor } from '@e07/shell/i18n/digits.ts';
import { formatWeekdayLetter, formatWeekdayName } from '@e07/shell/i18n/format-date.ts';
import { gameMessageText } from '@e07/shell/i18n/game-message-text.ts';
import { useLanguage } from '@e07/shell/i18n/language-context.tsx';
import { useT } from '@e07/shell/i18n/t-context.ts';
import { useLevelPlay } from '@e07/shell/screens/home/use-level-play.ts';
import { useSettingsResets } from '@e07/shell/screens/settings/use-settings-resets.ts';
import { selectDigits } from '@e07/shell/stores/settings-selectors.ts';
import { useSettingsStore } from '@e07/shell/stores/settings-store.ts';

import { statsSnapshotOf } from './stats-snapshot-of.ts';
import { useStatsSummary } from './use-stats-summary.ts';

import type { StatsModel } from './stats-model.ts';

export function useStatsModel(): StatsModel {
  const t = useT();
  const navigation = useNavigation();
  const host = useGameHost();
  const extra = useGameExtra();
  const openDialog = useOpenDialog();
  const { onConfirmResetStats } = useSettingsResets();
  const localeTag = localeTagFor(useLanguage(), useSettingsStore(selectDigits));
  const formatNumber = createNumberFormatter(localeTag);
  const summary = useStatsSummary({
    levelCount: levelCountOf(extra),
    hasEndless: extra.modes.endless,
    counterIds: host.counterIds,
  });
  return {
    isEmpty: summary.isEmpty,
    snapshot: statsSnapshotOf(summary, host.counters, {
      formatNumber,
      labelOf: (counter) => gameMessageText(t, { id: counter.labelId }),
      weekdayOf: (date) => ({
        letter: formatWeekdayLetter(date, t),
        weekdayName: formatWeekdayName(date, t),
      }),
    }),
    gameName: gameMessageText(t, { id: host.nameId }),
    logo: host.logo,
    formatNumber,
    formatPercent: createPercentFormatter(localeTag),
    isReducedMotion: useReduceMotion(),
    banner: useBannerSlot('stats'),
    onBack: () => {
      navigation.goBack();
    },
    onReset: () => {
      openDialog({ kind: 'reset-stats', onConfirm: onConfirmResetStats });
    },
    onPlay: useLevelPlay().onPlay,
  };
}
