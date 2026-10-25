// apps/merge-siege/src/testing/merge-siege-bot.test.ts
// The bot hooks the balance sims and the module's testing.bot use (game-balance-and-bots): the
// payoff is an enemy smashed, the twist one swipe smashing two or more (design notes, the kill test).
import { seedRng } from '@e07/game-kit/rng/sfc32.ts';
import { parseBoard } from '@e07/merge-siege/rules/board-text.ts';
import { create } from '@e07/merge-siege/rules/create.ts';
import { listMoves } from '@e07/merge-siege/rules/list-moves.ts';

import {
  evaluateMergeSiege,
  mergeSiegeBot,
  scoreOfMergeSiege,
  tagMergeSiegeEvent,
} from './merge-siege-bot.ts';

const EMPTY_ROW = '. . . . .';

describe('evaluateMergeSiege (re-exported for the bots)', () => {
  it('is the rules evaluation the level witness also plays with', () => {
    expect(evaluateMergeSiege(create(1, 0))).toBe(104);
  });
});

describe('scoreOfMergeSiege', () => {
  it('reports the points the top bar and the result show', () => {
    expect(scoreOfMergeSiege({ ...create(1, 0), score: 344 })).toBe(344);
  });
});

describe('tagMergeSiegeEvent', () => {
  const smash = { id: 1, tileId: 2, cell: 5, value: 2 };

  it('tags an enemy smashed as the payoff, and two or more in one event as the twist too', () => {
    expect(
      tagMergeSiegeEvent({ kind: 'enemies-smashed', phase: 'slide', smashes: [smash] }),
    ).toStrictEqual(['payoff']);
    expect(
      tagMergeSiegeEvent({
        kind: 'enemies-smashed',
        phase: 'slide',
        smashes: [smash, { ...smash, id: 3 }],
      }),
    ).toStrictEqual(['payoff', 'twist']);
  });

  it('tags nothing else', () => {
    expect(tagMergeSiegeEvent({ kind: 'tiles-merged', merges: [] })).toStrictEqual([]);
    expect(tagMergeSiegeEvent({ kind: 'score-added', points: 4, total: 4 })).toStrictEqual([]);
  });
});

describe('mergeSiegeBot', () => {
  it('swipes up on the opening, smashing both enemies at once', () => {
    const start = create(1, 0);
    expect(mergeSiegeBot(start, listMoves(start), seedRng(1)).move).toStrictEqual({
      kind: 'swipe',
      direction: 'up',
    });
  });

  it('merges two tiles rather than throwing a small one at a bigger enemy', () => {
    const state = {
      ...create(1, 0),
      cells: parseBoard([EMPTY_ROW, 'e16 . . . .', EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, '4 4 . . .']),
      next: null,
    };
    const { move } = mergeSiegeBot(state, listMoves(state), seedRng(3));
    expect(move.direction === 'left' || move.direction === 'right').toBe(true);
  });

  it('plays only listed moves on a real level', () => {
    const start = create(7, 40);
    const moves = listMoves(start);
    expect(moves).toContainEqual(mergeSiegeBot(start, moves, seedRng(7)).move);
  });
});
