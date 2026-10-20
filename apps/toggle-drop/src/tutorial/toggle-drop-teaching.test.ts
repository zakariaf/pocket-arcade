// apps/toggle-drop/src/tutorial/toggle-drop-teaching.test.ts
import { cellRect } from '@e07/game-kit/geom/board-layout.ts';
import { layoutBoard } from '@e07/toggle-drop/board/layout-board.ts';
import { toView } from '@e07/toggle-drop/board/to-view.ts';
import ckb from '@e07/toggle-drop/i18n/ckb.json';
import de from '@e07/toggle-drop/i18n/de.json';
import en from '@e07/toggle-drop/i18n/en.json';
import fa from '@e07/toggle-drop/i18n/fa.json';
import { applyMove } from '@e07/toggle-drop/rules/apply-move.ts';
import { listMoves } from '@e07/toggle-drop/rules/list-moves.ts';
import { outcome } from '@e07/toggle-drop/rules/outcome.ts';

import { TOGGLE_DROP_TEACHING } from './toggle-drop-teaching.ts';

import type { TutorialPointer } from '@e07/game-kit/contract/teaching.ts';
import type { ToggleDropState } from '@e07/toggle-drop/rules/toggle-drop-types.ts';

const LATIN = { formatNumber: (value: number) => String(value) };
/** The board area of a 402 × 874 pt phone. */
const PHONE_BOARD = { width: 374, height: 660 };

/** True when a target pointer names a cell the board draws inside the canvas (others pass). */
function isOnBoard(state: ToggleDropState, pointer: TutorialPointer): boolean {
  if (pointer.kind !== 'target') return pointer.kind === 'hud';
  const layout = layoutBoard({ ...PHONE_BOARD, view: toView(state, LATIN), isMirrored: false });
  const rect = cellRect(layout, pointer.target);
  return rect !== null && rect.y + rect.height <= layout.height;
}

describe('TOGGLE_DROP_TEACHING', () => {
  it('teaches in 3 to 5 how-to-play pages drawn from playing examples', () => {
    const pages = TOGGLE_DROP_TEACHING.howToPlay;
    expect(pages.length).toBeGreaterThanOrEqual(3);
    expect(pages.length).toBeLessThanOrEqual(5);
    expect(pages.every((page) => outcome(page.example).kind === 'playing')).toBe(true);
    expect(pages.every((page) => isOnBoard(page.example, page.pointer))).toBe(true);
  });

  it('expects one legal drop at every step, points at it, and the scripted drops win', () => {
    const { start, steps } = TOGGLE_DROP_TEACHING.tutorial;
    const end = steps.reduce((state, step) => {
      if (step.expect.kind !== 'move') throw new Error('every step expects one drop');
      expect(listMoves(state)).toContainEqual(step.expect.move);
      expect(step.pointer).toStrictEqual({
        kind: 'target',
        target: { regionId: 'board', col: step.expect.move.col, row: 0 },
      });
      expect(isOnBoard(state, step.pointer)).toBe(true);
      return applyMove(state, step.expect.move).state;
    }, start);
    expect(outcome(end).kind).toBe('won');
  });

  // The design notes' tutorial: the first drop goes left into the first cup and flips its switch,
  // the same drop then goes the other way, and the flipped second switch fills the last cup.
  it('shows the twist: the same column sends the second ball the other way', () => {
    const { start, steps } = TOGGLE_DROP_TEACHING.tutorial;
    const landings = steps.reduce<{ state: ToggleDropState; cols: number[] }>(
      (acc, step) => {
        if (step.expect.kind !== 'move') return acc;
        const result = applyMove(acc.state, step.expect.move);
        const landed = result.events.find((event) => event.kind === 'ball-landed');
        return { state: result.state, cols: [...acc.cols, landed?.col ?? -1] };
      },
      { state: start, cols: [] },
    );
    expect(
      steps.map((step) => (step.expect.kind === 'move' ? step.expect.move.col : -1)),
    ).toStrictEqual([1, 1, 2]);
    expect(landings.cols).toStrictEqual([0, 3, 1]);
  });

  it('has every text it uses in all four catalogs', () => {
    const { tutorial, howToPlay } = TOGGLE_DROP_TEACHING;
    const ids = [
      ...tutorial.steps.map((step) => step.messageId),
      ...howToPlay.flatMap((page) => [page.titleId, page.bodyId]),
    ];
    const missing = [en, de, fa, ckb].flatMap((catalog: Readonly<Record<string, string>>) =>
      ids.filter((id) => catalog[id] === undefined),
    );
    expect(missing).toStrictEqual([]);
  });
});
