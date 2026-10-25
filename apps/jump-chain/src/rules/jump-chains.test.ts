// apps/jump-chain/src/rules/jump-chains.test.ts
import fc from 'fast-check';

import { enemyAt, isDark, isOnBoard } from './board-squares.ts';
import { create } from './create.ts';
import { jumpChains, steps } from './jump-chains.ts';

import type { JumpChainMove, JumpChainState, Square } from './jump-chain-types.ts';

/** A level-0 state with your piece and the enemies on the given squares (ids in that order). */
function position(
  piece: Square,
  enemySquares: readonly (readonly [number, number])[],
): JumpChainState {
  const enemies = enemySquares.map(([col, row], id) => ({ id, rank: 0, col, row }));
  return { ...create(1, 0), piece, enemies, total: enemies.length, nextId: enemies.length };
}

/** A move as compact text: 'J 4,4 6,2' for a chain, 'S 2,6' for a step. */
function moveText(move: JumpChainMove): string {
  const squares = move.kind === 'step' ? [move.to] : move.path;
  return `${move.kind === 'step' ? 'S' : 'J'} ${squares.map((s) => `${String(s.col)},${String(s.row)}`).join(' ')}`;
}

/** A start state with the piece moved onto a free dark square picked by two numbers. */
function scatteredPosition(seed: number, colPick: number, rowPick: number): JumpChainState {
  const start = create(seed, 50);
  const row = rowPick % 10;
  const col = (colPick % 4) * 2 + (row % 2);
  const piece = { col: Math.min(col, 6), row };
  return enemyAt(start.enemies, piece) === undefined ? { ...start, piece } : start;
}

/** Every jump of a chain goes two squares diagonally over a different enemy onto a free square. */
function expectLegalChain(state: JumpChainState, path: readonly Square[]): void {
  let from = state.piece;
  const jumped: number[] = [];
  for (const to of path) {
    expect(isOnBoard(to) && isDark(to.col, to.row)).toBe(true);
    expect([Math.abs(to.col - from.col), Math.abs(to.row - from.row)]).toStrictEqual([2, 2]);
    const over = enemyAt(state.enemies, {
      col: (from.col + to.col) / 2,
      row: (from.row + to.row) / 2,
    });
    expect(over === undefined || jumped.includes(over.id)).toBe(false);
    jumped.push(over?.id ?? -1);
    from = to;
  }
}

/** The listed chains are legal, none twice, each after its shorter version. */
function expectChainList(state: JumpChainState): void {
  const texts = jumpChains(state).map(moveText);
  expect(new Set(texts).size).toBe(texts.length);
  for (const move of jumpChains(state)) {
    if (move.kind === 'jump') expectLegalChain(state, move.path);
  }
  for (const text of texts.filter((line) => line.split(' ').length > 2)) {
    const shorter = text.split(' ').slice(0, -1).join(' ');
    expect(texts.indexOf(shorter)).toBeLessThan(texts.indexOf(text));
  }
}

describe('jumpChains (spec 13: only multi-jump chains clear the ranks)', () => {
  it('jumps an enemy next to you onto the free square behind it, up-left before up-right', () => {
    const state = position({ col: 2, row: 6 }, [
      [1, 5],
      [3, 5],
    ]);
    expect(jumpChains(state).map(moveText)).toStrictEqual(['J 0,4', 'J 4,4']);
  });

  it('lists every chain and each of its shorter versions first, rank after rank', () => {
    const state = position({ col: 2, row: 6 }, [
      [3, 5],
      [5, 3],
    ]);
    expect(jumpChains(state).map(moveText)).toStrictEqual(['J 4,4', 'J 4,4 6,2']);
  });

  it('turns like a checkers king: a chain may go back down along a rank', () => {
    const state = position({ col: 0, row: 6 }, [
      [1, 5],
      [3, 5],
    ]);
    expect(jumpChains(state).map(moveText)).toStrictEqual(['J 2,4', 'J 2,4 4,6']);
  });

  it('jumps each enemy at most once in a chain', () => {
    const state = position({ col: 2, row: 6 }, [[3, 5]]);
    expect(jumpChains(state).map(moveText)).toStrictEqual(['J 4,4']);
  });

  it('requires a free square on the board behind the enemy', () => {
    const blocked = position({ col: 2, row: 4 }, [
      [3, 5],
      [4, 6],
    ]);
    const waiting = position({ col: 2, row: 0 }, [[1, -1]]);
    expect(jumpChains(blocked)).toStrictEqual([]);
    expect(jumpChains(waiting)).toStrictEqual([]);
  });

  it('keeps the pinned list of a three-rank position (the order is part of the contract)', () => {
    const state = position({ col: 2, row: 6 }, [
      [1, 5],
      [3, 5],
      [1, 3],
      [3, 3],
      [5, 3],
    ]);
    expect(jumpChains(state).map(moveText)).toStrictEqual(GOLDEN_THREE_RANK_CHAINS);
  });

  describe('properties', () => {
    it('lists only legal chains, none twice, each after its shorter version', () => {
      fc.assert(
        fc.property(fc.nat(), fc.nat(), fc.nat(), (seed, colPick, rowPick) => {
          expectChainList(scatteredPosition(seed, colPick, rowPick));
        }),
      );
    });
  });
});

describe('steps', () => {
  it('steps one square diagonally onto every free square: up-left, up-right, down-left, down-right', () => {
    const state = position({ col: 3, row: 7 }, [[5, 5]]);
    expect(steps(state).map(moveText)).toStrictEqual(['S 2,6', 'S 4,6', 'S 2,8', 'S 4,8']);
  });

  it('stays on the board and off the enemies', () => {
    const edge = position({ col: 0, row: 8 }, [[1, 7]]);
    expect(steps(edge).map(moveText)).toStrictEqual(['S 1,9']);
  });
});

const GOLDEN_THREE_RANK_CHAINS = [
  'J 0,4',
  'J 0,4 2,2',
  'J 0,4 2,2 4,4',
  'J 0,4 2,2 4,4 6,2',
  'J 0,4 2,2 4,4 2,6',
  'J 4,4',
  'J 4,4 2,2',
  'J 4,4 2,2 0,4',
  'J 4,4 2,2 0,4 2,6',
  'J 4,4 6,2',
];
