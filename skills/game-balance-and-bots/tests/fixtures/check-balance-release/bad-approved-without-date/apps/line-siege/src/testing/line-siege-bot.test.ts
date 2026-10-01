// apps/line-siege/src/testing/line-siege-bot.test.ts
import { seedRng } from '@e07/game-kit/rng/sfc32.ts';
import { applyMove } from '@e07/line-siege/rules/apply-move.ts';
import { create } from '@e07/line-siege/rules/create.ts';
import { listMoves } from '@e07/line-siege/rules/list-moves.ts';

import { lineSiegeBot, scoreOfLineSiege, tagLineSiegeEvent } from './line-siege-bot.ts';

describe('tagLineSiegeEvent', () => {
  it('tags defeats as the payoff and beams that hit as the twist', () => {
    expect(
      tagLineSiegeEvent({
        kind: 'monster-defeated',
        monsterId: 1,
        monsterKind: 'fast',
        lane: 0,
        row: 2,
      }),
    ).toStrictEqual(['payoff']);
    expect(tagLineSiegeEvent({ kind: 'beam-fired', lane: 2, targetId: 1 })).toStrictEqual([
      'twist',
    ]);
    expect(tagLineSiegeEvent({ kind: 'beam-fired', lane: 2, targetId: null })).toStrictEqual([]);
  });
});

describe('scoreOfLineSiege', () => {
  it('reports the points the top bar shows', () => {
    expect(scoreOfLineSiege({ ...create(1, 0), score: 135 })).toBe(135);
  });
});

describe('lineSiegeBot', () => {
  it('fires the prepared beam and defeats a monster on its first move', () => {
    const start = create(11, 0);
    const choice = lineSiegeBot(start, listMoves(start), seedRng(11));
    const kinds = applyMove(start, choice.move).events.map((event) => event.kind);
    expect(kinds).toContain('monster-defeated');
  });
});
