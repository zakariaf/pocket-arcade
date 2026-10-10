// packages/shell/src/screens/levels/use-levels-model.ts
// S8's model hook: the game's packs from the host, the stars from the progress store, the level
// numbers in the chosen digits, the tapped locked tile (local UI state: its focus ring and toast,
// whose text each tap also announces: iOS reads no live region) and the banner through
// useBannerSlot('levels'). A parity capture of the "locked tile tapped" frame
// (test builds) opens with the first locked tile tapped, through the same state a tap sets. An open
// tile plays its level through usePlayRun: the saved run of that level resumes (N10).
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useState } from 'react';

import { TEST_ONLY } from '@e07/shell/app/test-only.ts';
import { useBannerSlot } from '@e07/shell/app/use-ad-context.ts';
import { useAnnounce } from '@e07/shell/app/use-announce.ts';
import { useReduceMotion } from '@e07/shell/app/use-reduce-motion.ts';
import { useGameHost } from '@e07/shell/game-host/game-host-context.tsx';
import { gameMessageText } from '@e07/shell/i18n/game-message-text.ts';
import { useT } from '@e07/shell/i18n/t-context.ts';
import { useNumberFormatter } from '@e07/shell/i18n/use-number-formatter.ts';
import { usePlayRun } from '@e07/shell/screens/home/use-play-run.ts';
import { selectLevels } from '@e07/shell/stores/progress-selectors.ts';
import { useProgressStore } from '@e07/shell/stores/progress-store.ts';

import { levelPacksOf, starsByLevelOf, unlockingLevelOf } from './levels-model-of.ts';

import type { LevelPackModel, LevelsModel } from './levels-model.ts';

/** The first locked tile of the open packs (the parity frame taps it once), or null. */
export function firstLockedLevelOf(packs: readonly LevelPackModel[]): number | null {
  const tiles = packs.flatMap((pack) => pack.tiles);
  return tiles.find((tile) => tile.state.kind === 'locked')?.level ?? null;
}

type LockedTile = {
  readonly focusedLevel: number | null;
  readonly onTap: (level: number) => void;
  readonly onClear: () => void;
};

/**
 * The tapped locked tile: its focus ring and toast. Each tap also speaks the toast's words (a live
 * region alone is silent on iOS). The parity frame that shows it opens with the first locked tile
 * tapped, through the same state a tap sets.
 */
function useLockedTile(packs: readonly LevelPackModel[]): LockedTile {
  const t = useT();
  const announce = useAnnounce();
  const [focusedLevel, setFocusedLevel] = useState<number | null>(() =>
    TEST_ONLY?.parityFrameState() === 'levels-locked-tile-tapped'
      ? firstLockedLevelOf(packs)
      : null,
  );
  return {
    focusedLevel,
    onTap: (level) => {
      setFocusedLevel(level);
      announce(
        t('levels.level-tile.locked-toast', { previousLevel: unlockingLevelOf(packs, level) }),
      );
    },
    onClear: () => {
      setFocusedLevel(null);
    },
  };
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
  const lockedTile = useLockedTile(packModels);
  return {
    packs: packModels,
    focusedLevel: lockedTile.focusedLevel,
    // Also true during a parity capture (useReduceMotion): the current tile's flag bob holds still,
    // and while the Game screen covers Levels, so no endless bob runs on a screen nobody sees.
    isReducedMotion: isReduceMotionOn || !isFocused,
    banner: useBannerSlot('levels'),
    onBack: () => {
      navigation.goBack();
    },
    onPlayLevel: (level) => {
      lockedTile.onClear();
      playRun({ kind: 'level', level });
    },
    onTapLockedLevel: lockedTile.onTap,
  };
}
