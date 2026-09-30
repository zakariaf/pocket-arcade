// packages/shell/src/screens/levels/levels-model-of.test.ts
// no-shell-context: pure pack and tile rules.
import { levelPacksOf, starsByLevelOf } from './levels-model-of.ts';

import type { LevelsInput } from './levels-model-of.ts';
import type { LevelPack } from '@e07/game-kit/contract/levels.ts';

/** Line Siege's shape, smaller: three packs of four levels, the later ones at 6 and 12 stars. */
const PACKS: readonly LevelPack[] = [
  {
    id: 'first-wave',
    nameId: 'line-siege.pack-name.1',
    firstLevel: 1,
    levelCount: 4,
    starsToUnlock: 0,
  },
  {
    id: 'stronger-foes',
    nameId: 'line-siege.pack-name.2',
    firstLevel: 5,
    levelCount: 4,
    starsToUnlock: 6,
  },
  {
    id: 'last-stand',
    nameId: 'line-siege.pack-name.3',
    firstLevel: 9,
    levelCount: 4,
    starsToUnlock: 12,
  },
];

function input(stars: LevelsInput['stars']): LevelsInput {
  return {
    packs: PACKS,
    stars,
    formatNumber: (value) => `#${String(value)}`,
    nameOf: (pack) => pack.id,
  };
}

describe('levelPacksOf', () => {
  it('opens the first pack with one current level and shows only the next locked pack', () => {
    const packs = levelPacksOf(input({ 1: 3, 2: 1 }));

    expect(packs.map((pack) => [pack.name, pack.isLocked])).toStrictEqual([
      ['first-wave', false],
      ['stronger-foes', true],
    ]);
    expect(packs[0]?.tiles.map((tile) => tile.state)).toStrictEqual([
      { kind: 'completed', stars: 3 },
      { kind: 'completed', stars: 1 },
      { kind: 'current' },
      { kind: 'locked' },
    ]);
    expect(packs[0]).toMatchObject({ earnedStars: 4, totalStars: 12, progress: 4 / 12 });
    expect(packs[1]).toMatchObject({ unlockStars: 6, missingStars: 2, tiles: [] });
    expect(packs[0]?.tiles[0]?.numberText).toBe('#1');
  });

  it('opens a pack by stars collected, its first level whatever happened before it', () => {
    const packs = levelPacksOf(input({ 1: 3, 2: 3 }));

    expect(packs.map((pack) => pack.isLocked)).toStrictEqual([false, false, true]);
    expect(packs[1]?.tiles[0]?.state).toStrictEqual({ kind: 'current' });
    expect(packs[2]?.missingStars).toBe(6);
  });

  it('reads the best stars of each won level from the save', () => {
    const won = { bestScore: 10, bestMoves: null, completions: 1, firstCompletedOn: '2026-09-20' };
    expect(starsByLevelOf({ '1': { ...won, stars: 2 }, '12': { ...won, stars: 3 } })).toStrictEqual(
      {
        1: 2,
        12: 3,
      },
    );
  });
});
