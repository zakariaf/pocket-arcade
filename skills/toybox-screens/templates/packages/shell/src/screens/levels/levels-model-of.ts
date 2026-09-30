// packages/shell/src/screens/levels/levels-model-of.ts
// Pure: the S8 packs from the game's packs (useGameHost().packs) and the best stars per level
// (the progress store), with game-kit's unlock rules (pack-progress.ts): packs open by stars
// collected in total, and inside an open pack levels open one after another. Every open pack is a
// grid; only the first locked pack follows, as the dashed panel ("Unlocks at 45 stars").
import {
  isLevelUnlocked,
  isPackUnlocked,
  starsMissing,
} from '@e07/game-kit/levels/pack-progress.ts';

import type { LevelPackModel, LevelTileModel } from './levels-model.ts';
import type { LevelPack } from '@e07/game-kit/contract/levels.ts';
import type { StarsByLevel } from '@e07/game-kit/levels/pack-progress.ts';
import type { NumberFormatter } from '@e07/shell/i18n/create-number-formatter.ts';
import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';

export type LevelsInput = {
  readonly packs: readonly LevelPack[];
  readonly stars: StarsByLevel;
  readonly formatNumber: NumberFormatter;
  /** The pack's name in the player's language: gameMessageText(t, { id: pack.nameId }). */
  readonly nameOf: (pack: LevelPack) => string;
};

/** The progress store's won levels as best stars per level number. */
export function starsByLevelOf(levels: SaveDoc['progress']['levels']): StarsByLevel {
  return Object.fromEntries(
    Object.entries(levels).map(([level, result]) => [Number(level), result.stars]),
  );
}

function levelsOf(pack: LevelPack): number[] {
  return Array.from({ length: pack.levelCount }, (_, index) => pack.firstLevel + index);
}

/** A won level keeps its best stars (1-3); the save never stores 0 for a won level. */
function wonStars(stars: number): 1 | 2 | 3 {
  if (stars >= 3) return 3;
  return stars >= 2 ? 2 : 1;
}

function tileOf(level: number, input: LevelsInput): LevelTileModel {
  const stars = input.stars[level] ?? 0;
  const numberText = input.formatNumber(level);
  if (stars > 0) return { level, numberText, state: { kind: 'completed', stars: wonStars(stars) } };
  const isOpen = isLevelUnlocked(input.packs, input.stars, level);
  return { level, numberText, state: { kind: isOpen ? 'current' : 'locked' } };
}

function packOf(pack: LevelPack, index: number, input: LevelsInput): LevelPackModel {
  const levels = levelsOf(pack);
  const earnedStars = levels.reduce((total, level) => total + (input.stars[level] ?? 0), 0);
  const totalStars = pack.levelCount * 3;
  const isLocked = !isPackUnlocked(pack, input.stars);
  return {
    number: index + 1,
    name: input.nameOf(pack),
    levelsCount: pack.levelCount,
    earnedStars,
    totalStars,
    progress: totalStars === 0 ? 0 : earnedStars / totalStars,
    isLocked,
    unlockStars: pack.starsToUnlock,
    missingStars: starsMissing(pack, input.stars),
    tiles: isLocked ? [] : levels.map((level) => tileOf(level, input)),
  };
}

/** Every open pack, then the first locked one (the later locked packs stay hidden). */
export function levelPacksOf(input: LevelsInput): LevelPackModel[] {
  const all = input.packs.map((pack, index) => packOf(pack, index, input));
  const firstLocked = all.findIndex((pack) => pack.isLocked);
  return firstLocked === -1
    ? all
    : all.filter((pack, index) => !pack.isLocked || index === firstLocked);
}
