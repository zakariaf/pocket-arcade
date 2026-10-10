// packages/shell/src/screens/levels/use-levels-model.ts
// S8's model hook: the game's packs from the host, the stars from the progress store, the level
// numbers in the chosen digits, the tapped locked tile (local UI state: its focus ring and toast)
// and the banner through useBannerSlot('levels'). A parity capture of the "locked tile tapped" frame
// (test builds) opens with the first locked tile tapped, through the same state a tap sets. An open
// tile plays its level through usePlayRun: the saved run of that level resumes (N10).
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useState } from 'react';

import { TEST_ONLY } from '@e07/shell/app/test-only.ts';
import { useBannerSlot } from '@e07/shell/app/use-ad-context.ts';
import { useReduceMotion } from '@e07/shell/app/use-reduce-motion.ts';
import { useGameHost } from '@e07/shell/game-host/game-host-context.tsx';
import { gameMessageText } from '@e07/shell/i18n/game-message-text.ts';
import { useT } from '@e07/shell/i18n/t-context.ts';
import { useNumberFormatter } from '@e07/shell/i18n/use-number-formatter.ts';
import { usePlayRun } from '@e07/shell/screens/home/use-play-run.ts';
import { selectLevels } from '@e07/shell/stores/progress-selectors.ts';
import { useProgressStore } from '@e07/shell/stores/progress-store.ts';

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
  const isFocused = useIsFocused();
  const isReduceMotionOn = useReduceMotion();
  const playRun = usePlayRun();
  const { packs } = useGameHost();
  const levels = useProgressStore(selectLevels);
  const formatNumber = useNumberFormatter();
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
    // Also true during a parity capture (useReduceMotion): the current tile's flag bob holds still,
    // and while the Game screen covers Levels, so no endless bob runs on a screen nobody sees.
    isReducedMotion: isReduceMotionOn || !isFocused,
    banner: useBannerSlot('levels'),
    onBack: () => {
      navigation.goBack();
    },
    onPlayLevel: (level) => {
      setFocusedLevel(null);
      playRun({ kind: 'level', level });
    },
    onTapLockedLevel: setFocusedLevel,
  };
}
