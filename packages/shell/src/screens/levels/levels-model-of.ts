// packages/shell/src/screens/levels/levels-model-of.ts
// Pure: the S8 packs from the game's packs (useGameHost().packs) and the best stars per level
// (the progress store), with game-kit's unlock rules (pack-progress.ts): packs open by stars
// collected in total, and inside an open pack levels open one after another. Every open pack is a
// grid; only the first locked pack follows, as the dashed panel ("Unlocks at 45 stars").
import { totalStars } from '@e07/game-kit/levels/pack-progress.ts';

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

/**
 * A won level shows its stars; the first unfinished level of an open pack is its one `current`
 * tile (pack-progress's isLevelUnlocked: the pack's first level, or the one after a won level, and
 * the first unfinished level is always one of those); every other unfinished level is locked. An
 * old save can hold a won level after an unwon one (20 won, 19 not): 19 is current, and 21 stays
 * locked until 19 is won (spec S8, one after another), so a pack never shows two flags.
 */
function tilesOf(levels: readonly number[], input: LevelsInput): LevelTileModel[] {
  const current = levels.find((level) => (input.stars[level] ?? 0) === 0);
  return levels.map((level) => {
    const stars = input.stars[level] ?? 0;
    const numberText = input.formatNumber(level);
    if (stars > 0) {
      return { level, numberText, state: { kind: 'completed', stars: wonStars(stars) } };
    }
    return { level, numberText, state: { kind: level === current ? 'current' : 'locked' } };
  });
}

/** The input plus every star won so far (pack-progress's totalStars, counted once for all packs). */
type PackInput = LevelsInput & { readonly collected: number };

/** One pack: it opens at its starsToUnlock (isPackUnlocked), and missingStars is starsMissing. */
function packOf(pack: LevelPack, index: number, input: PackInput): LevelPackModel {
  const levels = levelsOf(pack);
  const earnedStars = levels.reduce((total, level) => total + (input.stars[level] ?? 0), 0);
  const packStars = pack.levelCount * 3;
  const missingStars = Math.max(0, pack.starsToUnlock - input.collected);
  const isLocked = missingStars > 0;
  return {
    number: index + 1,
    name: input.nameOf(pack),
    levelsCount: pack.levelCount,
    earnedStars,
    totalStars: packStars,
    progress: packStars === 0 ? 0 : earnedStars / packStars,
    isLocked,
    unlockStars: pack.starsToUnlock,
    missingStars,
    tiles: isLocked ? [] : tilesOf(levels, input),
  };
}

/** Every open pack, then the first locked one (the later locked packs stay hidden). */
export function levelPacksOf(input: LevelsInput): LevelPackModel[] {
  const packInput = { ...input, collected: totalStars(input.stars) };
  const all = input.packs.map((pack, index) => packOf(pack, index, packInput));
  const firstLocked = all.findIndex((pack) => pack.isLocked);
  return firstLocked === -1
    ? all
    : all.filter((pack, index) => !pack.isLocked || index === firstLocked);
}

/**
 * The level a tapped locked tile waits for: its open pack's current level (the toast's "finish
 * level n"). Locked tiles sit only in open packs, after their pack's one current tile, so that
 * level opens them one after another; the tile before is often locked or won itself.
 */
export function unlockingLevelOf(packs: readonly LevelPackModel[], level: number): number {
  const pack = packs.find((candidate) => candidate.tiles.some((tile) => tile.level === level));
  const current = pack?.tiles.find((tile) => tile.state.kind === 'current');
  return current?.level ?? level - 1;
}
