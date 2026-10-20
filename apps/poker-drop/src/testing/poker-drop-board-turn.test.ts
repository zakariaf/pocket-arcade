// apps/poker-drop/src/testing/poker-drop-board-turn.test.ts
import { busiestBoardTurn } from './poker-drop-board-turn.ts';

describe('busiestBoardTurn', () => {
  it('plays every event kind of a drop: a two-step cascade, a rising row with its own hand, falls', () => {
    const kinds = busiestBoardTurn().result.events.map((event) => event.kind);
    expect(kinds).toStrictEqual([
      'card-dropped',
      'hand-burst',
      'cards-fell',
      'hand-burst',
      'cards-fell',
      'row-rose',
      'hand-burst',
      'cards-fell',
      'card-dealt',
    ]);
  });

  it('leaves eight cards in the well and three hands made', () => {
    const { state } = busiestBoardTurn().result;
    expect(state.cells.filter((cell) => cell !== null)).toHaveLength(8);
    expect(state.handsMade).toBe(3);
  });

  it('returns the same turn every time', () => {
    expect(busiestBoardTurn()).toStrictEqual(busiestBoardTurn());
  });
});
