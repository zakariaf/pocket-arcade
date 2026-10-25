// apps/stepstone/src/tutorial/stepstone-teaching.test.ts
// Spec 2.1 and S13: the game teaches itself in its first level, one short sentence and one pointer
// at a time, every expected move legal; How to play has 3 to 5 short pages with a board picture.
import ckb from '@e07/stepstone/i18n/ckb.json';
import de from '@e07/stepstone/i18n/de.json';
import en from '@e07/stepstone/i18n/en.json';
import fa from '@e07/stepstone/i18n/fa.json';
import { applyMove } from '@e07/stepstone/rules/apply-move.ts';
import { listMoves } from '@e07/stepstone/rules/list-moves.ts';
import { outcome } from '@e07/stepstone/rules/outcome.ts';

import { STEPSTONE_TEACHING } from './stepstone-teaching.ts';

import type { TutorialPointer } from '@e07/game-kit/contract/teaching.ts';

const CATALOGS = { en, de, fa, ckb };
const { tutorial, howToPlay } = STEPSTONE_TEACHING;

/** True when the pointer rests on a pond cell (or on a top-bar key, which is not on the pond). */
function isOnPond(pointer: TutorialPointer, side: number): boolean {
  if (pointer.kind !== 'target') return pointer.kind === 'hud';
  const { regionId, col, row } = pointer.target;
  return regionId === 'board' && col >= 0 && row >= 0 && col < side && row < side;
}

describe('STEPSTONE_TEACHING', () => {
  it('teaches in 3 to 5 how-to-play pages drawn from playing examples', () => {
    expect(howToPlay.length).toBeGreaterThanOrEqual(3);
    expect(howToPlay.length).toBeLessThanOrEqual(5);
    expect(howToPlay.every((page) => outcome(page.example).kind === 'playing')).toBe(true);
    expect(howToPlay.every((page) => isOnPond(page.pointer, page.example.side))).toBe(true);
  });

  it('expects one legal hop at every step, pointed at, and the scripted hops cross the pond', () => {
    const end = tutorial.steps.reduce((state, step) => {
      if (step.expect.kind !== 'move') throw new Error('every tutorial step expects a hop');
      const { to } = step.expect.move;
      expect(listMoves(state)).toStrictEqual([step.expect.move]);
      expect(step.pointer).toStrictEqual({
        kind: 'target',
        target: { regionId: 'board', col: to % state.side, row: Math.floor(to / state.side) },
      });
      return applyMove(state, step.expect.move).state;
    }, tutorial.start);
    expect(outcome(end)).toStrictEqual({ kind: 'won', score: tutorial.steps.length });
  });

  it('changes the hop kind on every scripted hop but the last, which lands on the flag', () => {
    const kinds = tutorial.steps.map((step, index) => {
      const before = tutorial.steps
        .slice(0, index)
        .reduce(
          (state, earlier) =>
            earlier.expect.kind === 'move' ? applyMove(state, earlier.expect.move).state : state,
          tutorial.start,
        );
      if (step.expect.kind !== 'move') return 'none';
      const events = applyMove(before, step.expect.move).events.map((event) => event.kind);
      return events.includes('goal-reached')
        ? 'flag'
        : String(events.includes('move-kind-changed'));
    });
    expect(kinds).toStrictEqual(['true', 'true', 'true', 'flag']);
  });

  it('finds every text the script and the pages use in all four catalogs', () => {
    const ids = [
      ...tutorial.steps.map((step) => step.messageId),
      ...howToPlay.flatMap((page) => [page.titleId, page.bodyId]),
    ];
    for (const catalog of Object.values(CATALOGS)) {
      expect(ids.filter((id) => !(id in catalog))).toStrictEqual([]);
    }
  });
});
