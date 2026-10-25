// apps/poker-drop/src/testing/poker-drop-bot.test.ts
import { seedRng } from '@e07/game-kit/rng/sfc32.ts';
import { applyMove } from '@e07/poker-drop/rules/apply-move.ts';
import { create } from '@e07/poker-drop/rules/create.ts';
import { listMoves } from '@e07/poker-drop/rules/list-moves.ts';

import { pokerDropBot, scoreOfPokerDrop, tagPokerDropEvent } from './poker-drop-bot.ts';

import type { PokerDropEvent } from '@e07/poker-drop/rules/poker-drop-types.ts';

const BURST: PokerDropEvent = {
  kind: 'hand-burst',
  step: 1,
  hand: 'two-pair',
  lineKind: 'row',
  line: [0, 1, 2, 3, 4],
  cells: [0, 1, 3, 4],
  cards: [9, 22, 10, 23],
  points: 20,
  atMs: 400,
};

describe('tagPokerDropEvent', () => {
  // game-balance-and-bots, kill test: the payoff is a burst hand, the twist a cascade's hand.
  it('tags every burst hand as the payoff and a cascade step as the twist', () => {
    expect(tagPokerDropEvent(BURST)).toStrictEqual(['payoff']);
    expect(tagPokerDropEvent({ ...BURST, step: 2 })).toStrictEqual(['payoff', 'twist']);
    expect(tagPokerDropEvent({ kind: 'card-dealt', hand: 1, next: 2, atMs: 900 })).toStrictEqual(
      [],
    );
  });
});

describe('scoreOfPokerDrop', () => {
  it('reports the points the top bar shows', () => {
    expect(scoreOfPokerDrop({ ...create(1, 0), score: 135 })).toBe(135);
  });
});

describe('pokerDropBot', () => {
  it('drops into the prepared gap and bursts a hand on its first move', () => {
    const start = create(11, 0);
    const choice = pokerDropBot(start, listMoves(start), seedRng(11));
    const kinds = applyMove(start, choice.move).events.map((event) => event.kind);
    expect(kinds).toContain('hand-burst');
  });

  it('picks a legal move, the same one for the same state and random state', () => {
    const state = create(4, 60);
    const choice = pokerDropBot(state, listMoves(state), seedRng(4));
    expect(listMoves(state)).toContainEqual(choice.move);
    expect(pokerDropBot(state, listMoves(state), seedRng(4))).toStrictEqual(choice);
  });
});
