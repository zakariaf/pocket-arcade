// packages/shell/src/screens/levels/levels-model-of.test.ts
// no-shell-context: pure pack and tile rules.
import { defaultStarsToUnlock } from '@e07/game-kit/levels/pack-progress.ts';
import { createNumberFormatter } from '@e07/shell/i18n/create-number-formatter.ts';
import { localeTagFor } from '@e07/shell/i18n/digits.ts';

import { levelPacksOf, starsByLevelOf, unlockingLevelOf } from './levels-model-of.ts';

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

  describe("with Line Siege's real shape (spec S8: three packs of 30 opening at 0, 45 and 90)", () => {
    const LINE_SIEGE_PACKS: readonly LevelPack[] = [0, 1, 2].map((index) => ({
      id: `pack-${String(index + 1)}`,
      nameId: `line-siege.pack-name.${String(index + 1)}`,
      firstLevel: 1 + index * 30,
      levelCount: 30,
      starsToUnlock: defaultStarsToUnlock(index, 30),
    }));

    /** Levels 1..n won with the given stars each. */
    function wonThrough(stars: readonly number[]): LevelsInput['stars'] {
      return Object.fromEntries(stars.map((value, index) => [index + 1, value]));
    }

    function lineSiege(stars: LevelsInput['stars']) {
      return levelPacksOf({ ...input(stars), packs: LINE_SIEGE_PACKS });
    }

    it('keeps pack 2 locked at 44 stars, one star short of 45', () => {
      const packs = lineSiege(wonThrough([...Array<number>(14).fill(3), 2]));

      expect(packs.map((pack) => pack.isLocked)).toStrictEqual([false, true]);
      expect(packs[1]).toMatchObject({ number: 2, unlockStars: 45, missingStars: 1, tiles: [] });
    });

    it('opens pack 2 at 45 stars with its first level current', () => {
      const packs = lineSiege(wonThrough(Array<number>(15).fill(3)));

      expect(packs.map((pack) => pack.isLocked)).toStrictEqual([false, false, true]);
      expect(packs[1]?.tiles[0]).toMatchObject({ level: 31, state: { kind: 'current' } });
      expect(packs[2]).toMatchObject({ unlockStars: 90, missingStars: 45 });
    });

    it('opens pack 3 at 90 stars', () => {
      const packs = lineSiege(wonThrough(Array<number>(30).fill(3)));

      expect(packs.map((pack) => pack.isLocked)).toStrictEqual([false, false, false]);
      expect(packs[2]?.tiles[0]).toMatchObject({ level: 61, state: { kind: 'current' } });
    });

    it("draws the design's player: 28 / 90 stars, level 12 current, pack 2 missing 17", () => {
      const packs = lineSiege(wonThrough([3, 3, 2, 3, 1, 3, 3, 2, 3, 2, 3]));
      const [first, second] = packs;
      const kinds = first?.tiles.map((tile) => tile.state.kind) ?? [];

      expect(packs).toHaveLength(2);
      expect(first).toMatchObject({ earnedStars: 28, totalStars: 90, progress: 28 / 90 });
      expect(kinds.filter((kind) => kind === 'current')).toHaveLength(1);
      expect(first?.tiles[11]).toMatchObject({ level: 12, state: { kind: 'current' } });
      expect(kinds.slice(12)).toStrictEqual(Array<string>(18).fill('locked'));
      expect(second).toMatchObject({ isLocked: true, missingStars: 17 });
    });

    it('makes the first open unfinished level current, never two in one pack (S8: one after another)', () => {
      const stars = { ...wonThrough(Array<number>(18).fill(3)), 20: 2 };
      const [first] = lineSiege(stars);
      const current = first?.tiles.filter((tile) => tile.state.kind === 'current') ?? [];

      expect(current.map((tile) => tile.level)).toStrictEqual([19]);
      expect(first?.tiles[19]?.state).toStrictEqual({ kind: 'completed', stars: 2 });
      expect(first?.tiles[20]?.state).toStrictEqual({ kind: 'locked' });
    });
  });

  it('writes each tile number with the formatter it is given (spec 7.3: Persian digits)', () => {
    const persian = createNumberFormatter(localeTagFor('fa', 'automatic'));
    const packs = levelPacksOf({ ...input({}), formatNumber: persian });

    expect(packs[0]?.tiles.map((tile) => tile.numberText)).toStrictEqual(['۱', '۲', '۳', '۴']);
    expect(persian(12)).toBe('۱۲');
  });
});

describe('unlockingLevelOf', () => {
  it("names the open pack's current level for any locked tile of that pack (spec S8)", () => {
    // Level 1 won: pack 1 has 2 current, 3 and 4 locked; pack 2 stays locked (3 of 6 stars).
    const onePack = levelPacksOf(input({ 1: 3 }));
    // Levels 1 and 2 won: 6 stars open pack 2, whose current level is 5.
    const twoPacks = levelPacksOf(input({ 1: 3, 2: 3 }));

    expect(unlockingLevelOf(onePack, 3)).toBe(2);
    expect(unlockingLevelOf(onePack, 4)).toBe(2);
    expect(unlockingLevelOf(twoPacks, 4)).toBe(3);
    expect(unlockingLevelOf(twoPacks, 8)).toBe(5);
  });
});
