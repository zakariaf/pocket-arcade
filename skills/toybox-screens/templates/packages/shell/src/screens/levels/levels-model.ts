// packages/shell/src/screens/levels/levels-model.ts
// What S8 Levels draws. use-levels-model.ts builds it from the progress store and the game's packs.
import type { AdBannerSlotProps } from '@e07/shell/ui/ad-banner-slot.tsx';
import type { LevelTileState } from '@e07/shell/ui/level-tile.tsx';

export type LevelTileModel = {
  readonly level: number;
  /** The level number in the chosen digits. */
  readonly numberText: string;
  /**
   * completed (1-3 stars) · current (the next level: exactly one) · locked (everything after it).
   * The Toybox LevelTile's own state type, so the view passes it straight through.
   */
  readonly state: LevelTileState;
};

export type LevelPackModel = {
  readonly number: number;
  /** games.<id>.packs[n], or levels.pack.default-name-<n> when the game names no packs. */
  readonly name: string;
  readonly levelsCount: number;
  readonly earnedStars: number;
  readonly totalStars: number;
  /** earnedStars / totalStars, 0..1. */
  readonly progress: number;
  /** Packs unlock by stars collected; Premium never unlocks levels (decision D2). */
  readonly isLocked: boolean;
  readonly unlockStars: number;
  readonly missingStars: number;
  readonly tiles: readonly LevelTileModel[];
};

export type LevelsModel = {
  readonly packs: readonly LevelPackModel[];
  /** The locked tile just tapped: focus ring plus the "finish level n" toast. */
  readonly focusedLevel: number | null;
  readonly isReducedMotion: boolean;
  readonly banner: Pick<AdBannerSlotProps, 'renderBanner' | 'isAllowed'>;
  readonly onBack: () => void;
  readonly onPlayLevel: (level: number) => void;
  readonly onTapLockedLevel: (level: number) => void;
};
