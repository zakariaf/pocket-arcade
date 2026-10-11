// packages/tooling/src/e2e/level-line.test.ts
// The taps a level-1 flow needs, over two tiny games: a one-tap board (tap a cell to fill it) and
// a tap-then-tap board (select a tray slot, then tap the cell). Moves are checked through each
// game's own intentToMove, and the bot plays with playBot's seed rule.
import { levelLine, formatLevelLine, tapsFor } from './level-line.ts';

import type { LineGame } from './level-line.ts';
import type { LevelEntry } from '@e07/game-kit/contract/levels.ts';

type Cells = { readonly cells: readonly number[]; readonly score: number };
type Fill = { readonly slot: number; readonly col: number };

const ENTRY: LevelEntry = {
  level: 1,
  seed: 7,
  difficulty: 0,
  stars: { kind: 'score', thresholds: [0, 20, 30] },
};

/** Fill all three cells; slot 1 scores double. selectRegions decides one tap or two. */
function fillGame(selectRegions: readonly string[]): LineGame<Cells, Fill> {
  const isTwoTap = selectRegions.length > 0;
  return {
    engine: {
      create: () => ({ cells: [0, 0, 0], score: 0 }),
      listMoves: (state) =>
        state.cells.flatMap((cell, col) => (cell === 0 ? [{ slot: isTwoTap ? 1 : 0, col }] : [])),
      applyMove: (state, move) => ({
        state: {
          cells: state.cells.map((cell, col) => (col === move.col ? 1 : cell)),
          score: state.score + (move.slot === 1 ? 10 : 5),
        },
        events: [],
      }),
      outcome: (state) =>
        state.cells.every((cell) => cell === 1)
          ? { kind: 'won', score: state.score }
          : { kind: 'playing' },
      selectRegions,
      intentToMove: (_state, intent) => {
        if (intent.kind !== 'tap' || intent.target.regionId !== 'board') return null;
        if (!isTwoTap) return { slot: 0, col: intent.target.col };
        return intent.selected === null
          ? null
          : { slot: intent.selected.col, col: intent.target.col };
      },
    },
    bot: (_state, moves, rng) => ({ move: moves[moves.length - 1] ?? { slot: 0, col: 0 }, rng }),
    winExample: () => ({ cells: [1, 1, 1], score: 25 }),
    targetsOfMove: (_state, move) => [
      ...(isTwoTap ? [{ regionId: 'tray', col: move.slot, row: 0 }] : []),
      { regionId: 'board', col: move.col, row: 0 },
    ],
  };
}

describe('tapsFor', () => {
  it('finds the one tap of a one-tap board', () => {
    const game = fillGame([]);
    expect(tapsFor(game, game.engine.create(1, 0), { slot: 0, col: 2 })).toStrictEqual([
      { regionId: 'board', col: 2, row: 0 },
    ]);
  });

  it('selects in the select region first on a tap-then-tap board', () => {
    const game = fillGame(['tray']);
    expect(tapsFor(game, game.engine.create(1, 0), { slot: 1, col: 0 })).toStrictEqual([
      { regionId: 'tray', col: 1, row: 0 },
      { regionId: 'board', col: 0, row: 0 },
    ]);
  });

  it('gives no taps without targetsOfMove or when intentToMove disagrees', () => {
    const { engine, bot, winExample } = fillGame([]);
    const noTargets = { engine, bot, winExample };
    expect(tapsFor(noTargets, { cells: [0, 0, 0], score: 0 }, { slot: 0, col: 0 })).toBeNull();
    const game = fillGame([]);
    expect(tapsFor(game, game.engine.create(1, 0), { slot: 1, col: 0 })).toBeNull();
  });
});

describe('levelLine', () => {
  it("prints the first tappable move, the bot's line and the stars the example win earns", () => {
    const result = levelLine(fillGame(['tray']), ENTRY);
    expect(result.first?.taps).toStrictEqual([
      { regionId: 'tray', col: 1, row: 0 },
      { regionId: 'board', col: 0, row: 0 },
    ]);
    expect(result.line.map((step) => step.move.col)).toStrictEqual([2, 1, 0]);
    expect(result.outcome).toStrictEqual({ kind: 'won', score: 30 });
    // The example win scores 25 against 0 / 20 / 30: two stars.
    expect(result.winStars).toBe(2);
    expect(formatLevelLine('demo', ENTRY, result).slice(1, 4)).toStrictEqual([
      'first move: {"slot":1,"col":0}\n  taps: tray col 1 row 0, then board col 0 row 0',
      "action=win-level earns 2 star(s): assert result.stars-2 and list it in the game's e2e/testids.json",
      'bot line: 3 moves, won with score 30',
    ]);
  });

  it('stops the line at the move cap', () => {
    expect(levelLine(fillGame([]), ENTRY, 1).line).toHaveLength(1);
  });
});
