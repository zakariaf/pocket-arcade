// apps/merge-siege/src/rules/merge-siege-rules.golden.test.ts
// RULES GOLDEN. One seeded game of Merge Siege (seed 1, difficulty 0, a fixed legal move line): its
// event stream and final board. A diff here means the rules changed: saved runs, replays and the
// generated levels change with them. Update only on purpose with
// `npx jest <this file> --ci --selectProjects golden -u` and a `Gate-Change:` commit trailer.
import { playChoices } from '@e07/game-kit/testing/play-choices.ts';

import { applyMove } from './apply-move.ts';
import { boardText } from './board-text.ts';
import { create } from './create.ts';
import { listMoves } from './list-moves.ts';
import { outcome } from './outcome.ts';

/** The move line: the choice index into listMoves at each swipe (up, down, left, right order). */
const CHOICES = [0, 3, 2, 0, 1, 3, 0, 2, 0, 3, 1, 0, 2, 3, 0, 0];

describe('the Merge Siege rules golden', () => {
  it('keeps the event stream and the final board of seed 1 at difficulty 0', () => {
    const { states, events } = playChoices({ listMoves, applyMove }, create(1, 0), CHOICES);
    const final = states[states.length - 1] ?? create(1, 0);
    expect({
      swipes: final.swipes,
      outcome: outcome(final),
      board: boardText(final.cells).split('\n'),
      next: final.next,
      score: final.score,
      smashed: final.smashed,
      events: events.map((event) => JSON.stringify(event)),
    }).toMatchSnapshot();
  });
});
