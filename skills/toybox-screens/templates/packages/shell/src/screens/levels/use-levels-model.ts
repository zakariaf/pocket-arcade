// packages/shell/src/screens/levels/use-levels-model.ts
// S8's model hook: the game's packs from the host, the stars from the progress store, the level
// numbers in the chosen digits, the tapped locked tile (local UI state: its focus ring and toast)
// and the banner through useBannerSlot('levels'). A parity capture of the "locked tile tapped" frame
// (test builds) opens with the first locked tile tapped, through the same state a tap sets.
import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';

import { TEST_ONLY } from '@e07/shell/app/test-only.ts';
import { useBannerSlot } from '@e07/shell/app/use-ad-context.ts';
import { useReduceMotion } from '@e07/shell/app/use-reduce-motion.ts';
import { useGameHost } from '@e07/shell/game-host/game-host-context.tsx';
import { createNumberFormatter } from '@e07/shell/i18n/create-number-formatter.ts';
import { localeTagFor } from '@e07/shell/i18n/digits.ts';
import { gameMessageText } from '@e07/shell/i18n/game-message-text.ts';
import { useLanguage } from '@e07/shell/i18n/language-context.tsx';
import { useT } from '@e07/shell/i18n/t-context.ts';
import { selectLevels } from '@e07/shell/stores/progress-selectors.ts';
import { useProgressStore } from '@e07/shell/stores/progress-store.ts';
import { selectDigits } from '@e07/shell/stores/settings-selectors.ts';
import { useSettingsStore } from '@e07/shell/stores/settings-store.ts';

import { levelPacksOf, starsByLevelOf } from './levels-model-of.ts';

import type { LevelPackModel, LevelsModel } from './levels-model.ts';

/** The first locked tile of the open packs (the parity frame taps it once), or null. */
export function firstLockedLevelOf(packs: readonly LevelPackModel[]): number | null {
  const tiles = packs.flatMap((pack) => pack.tiles);
  return tiles.find((tile) => tile.state.kind === 'locked')?.level ?? null;
}

export function useLevelsModel(): LevelsModel {
  const t = useT();
  const navigation = useNavigation();
  const { packs } = useGameHost();
  const levels = useProgressStore(selectLevels);
  const formatNumber = createNumberFormatter(
    localeTagFor(useLanguage(), useSettingsStore(selectDigits)),
  );
  const packModels = levelPacksOf({
    packs,
    stars: starsByLevelOf(levels),
    formatNumber,
    nameOf: (pack) => gameMessageText(t, { id: pack.nameId }),
  });
  const [focusedLevel, setFocusedLevel] = useState<number | null>(() =>
    TEST_ONLY?.parityFrameState() === 'levels-locked-tile-tapped'
      ? firstLockedLevelOf(packModels)
      : null,
  );
  return {
    packs: packModels,
    focusedLevel,
    // Also true during a parity capture (useReduceMotion): the current tile's flag bob holds still.
    isReducedMotion: useReduceMotion(),
    banner: useBannerSlot('levels'),
    onBack: () => {
      navigation.goBack();
    },
    onPlayLevel: (level) => {
      setFocusedLevel(null);
      navigation.navigate('Game', { start: 'new', ref: { kind: 'level', level } });
    },
    onTapLockedLevel: setFocusedLevel,
  };
}
