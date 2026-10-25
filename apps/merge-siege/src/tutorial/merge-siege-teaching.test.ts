// apps/merge-siege/src/tutorial/merge-siege-teaching.test.ts
// Spec 2.1 and S13: Merge Siege teaches itself in its first level, one short sentence and one
// pointer per step, every expected move legal, and the script ends in a win; How to play has 3 to
// 5 pages drawn by the game's own board, and every key they use is in all four catalogs.
import { cellRect } from '@e07/game-kit/geom/board-layout.ts';
import { layoutBoard } from '@e07/merge-siege/board/layout-board.ts';
import { toView } from '@e07/merge-siege/board/to-view.ts';
import ckb from '@e07/merge-siege/i18n/ckb.json' with { type: 'json' };
import de from '@e07/merge-siege/i18n/de.json' with { type: 'json' };
import en from '@e07/merge-siege/i18n/en.json' with { type: 'json' };
import fa from '@e07/merge-siege/i18n/fa.json' with { type: 'json' };
import { applyMove } from '@e07/merge-siege/rules/apply-move.ts';
import { listMoves } from '@e07/merge-siege/rules/list-moves.ts';
import { outcome } from '@e07/merge-siege/rules/outcome.ts';

import { MERGE_SIEGE_TEACHING } from './merge-siege-teaching.ts';

import type { TutorialPointer } from '@e07/game-kit/contract/teaching.ts';
import type { BoardTarget } from '@e07/game-kit/geom/board-layout.ts';
import type { MergeSiegeEvent, MergeSiegeState } from '@e07/merge-siege/rules/merge-siege-types.ts';

const { start, steps } = MERGE_SIEGE_TEACHING.tutorial;
const LAYOUT = layoutBoard({
  width: 390,
  height: 560,
  view: toView(start, { formatNumber: (value) => String(value) }),
  isMirrored: false,
});

/** Every scripted move in turn: the events of each step, and the state after the last one. */
function playScript(): { readonly turns: MergeSiegeEvent[][]; readonly end: MergeSiegeState } {
  const turns: MergeSiegeEvent[][] = [];
  let state = start;
  for (const step of steps) {
    if (step.expect.kind !== 'move') throw new Error('every tutorial step expects one move');
    expect(listMoves(state)).toContainEqual(step.expect.move);
    const result = applyMove(state, step.expect.move);
    turns.push([...result.events]);
    state = result.state;
  }
  return { turns, end: state };
}

function targetsOf(pointer: TutorialPointer): readonly BoardTarget[] {
  if (pointer.kind === 'drag') return [pointer.from, pointer.to];
  return pointer.kind === 'target' ? [pointer.target] : [];
}

function isInsideLayout(target: BoardTarget): boolean {
  const region = LAYOUT.regions.find((candidate) => candidate.id === target.regionId);
  const isOnGrid =
    region !== undefined &&
    target.col >= 0 &&
    target.row >= 0 &&
    target.col < region.cols &&
    target.row < region.rows;
  return isOnGrid && cellRect(LAYOUT, target) !== null;
}

const kindsOf = (events: readonly MergeSiegeEvent[]): string[] => events.map((event) => event.kind);

describe('MERGE_SIEGE_TEACHING', () => {
  it('teaches in 3 to 5 how-to-play pages drawn from playing examples', () => {
    const pages = MERGE_SIEGE_TEACHING.howToPlay;
    expect(pages.length).toBeGreaterThanOrEqual(3);
    expect(pages.length).toBeLessThanOrEqual(5);
    expect(pages.every((page) => outcome(page.example).kind === 'playing')).toBe(true);
  });

  it('expects a legal move at every step, and the scripted moves win the tutorial', () => {
    expect(outcome(start).kind).toBe('playing');
    expect(outcome(playScript().end).kind).toBe('won');
  });

  it('smashes, then merges, then smashes a 4 with the merged tile, then the last enemy', () => {
    const [smash, merge, bigger, last] = playScript().turns;
    expect(kindsOf(smash ?? [])).toContain('enemies-smashed');
    const merged = (merge ?? []).find((event) => event.kind === 'tiles-merged');
    if (merged?.kind !== 'tiles-merged') throw new Error('step 2 merges');
    const big = (bigger ?? []).flatMap((event) =>
      event.kind === 'enemies-smashed' ? event.smashes : [],
    );
    expect(
      big.some((smashed) => smashed.value === 4 && smashed.tileId === merged.merges[0]?.intoId),
    ).toBe(true);
    expect(kindsOf(last ?? [])).toContain('enemies-smashed');
    expect(
      playScript()
        .turns.flat()
        .some((event) => event.kind === 'tiles-lost'),
    ).toBe(false);
  });

  it('points every step and page at cells inside the board layout', () => {
    const pointers = [
      ...steps.map((step) => step.pointer),
      ...MERGE_SIEGE_TEACHING.howToPlay.map((page) => page.pointer),
    ];
    expect(steps.every((step) => step.pointer.kind !== 'none')).toBe(true);
    expect(pointers.flatMap(targetsOf).every(isInsideLayout)).toBe(true);
  });

  it('finds every key the script and the pages use in all four catalogs', () => {
    const keys = [
      ...steps.map((step) => step.messageId),
      ...MERGE_SIEGE_TEACHING.howToPlay.flatMap((page) => [page.titleId, page.bodyId]),
    ];
    for (const catalog of [en, de, fa, ckb]) {
      expect(keys.filter((key) => !(key in catalog))).toStrictEqual([]);
    }
  });
});
