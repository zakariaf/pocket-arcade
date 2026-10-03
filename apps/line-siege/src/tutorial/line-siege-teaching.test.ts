// apps/line-siege/src/tutorial/line-siege-teaching.test.ts
import { applyMove } from '@e07/line-siege/rules/apply-move.ts';
import { listMoves } from '@e07/line-siege/rules/list-moves.ts';
import { outcome } from '@e07/line-siege/rules/outcome.ts';

import { LINE_SIEGE_TEACHING } from './line-siege-teaching.ts';

describe('LINE_SIEGE_TEACHING', () => {
  it('teaches in 3 to 5 how-to-play pages drawn from playing examples', () => {
    const pages = LINE_SIEGE_TEACHING.howToPlay;
    expect(pages.length).toBeGreaterThanOrEqual(3);
    expect(pages.length).toBeLessThanOrEqual(5);
    expect(pages.every((page) => outcome(page.example).kind === 'playing')).toBe(true);
  });

  it('expects a legal first placement that fills the prepared column and fires its beam', () => {
    const { start, steps } = LINE_SIEGE_TEACHING.tutorial;
    const [first] = steps;
    if (first?.expect.kind !== 'move') throw new Error('the first step expects a move');
    expect(listMoves(start)).toContainEqual(first.expect.move);
    const kinds = applyMove(start, first.expect.move).events.map((event) => event.kind);
    expect(kinds).toContain('beam-fired');
  });
});
