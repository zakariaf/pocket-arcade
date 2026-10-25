// apps/trail-clear/src/tutorial/trail-clear-teaching.test.ts
// Spec S13: "The first level is a guided tutorial: a pointer hand shows what to do, one short
// sentence at a time ... Every game has 3 to 5 How to play steps, each with a small picture drawn
// by the game's own board code."
import { cellRect } from '@e07/game-kit/geom/board-layout.ts';
import { layoutBoard } from '@e07/trail-clear/board/layout-board.ts';
import { toView } from '@e07/trail-clear/board/to-view.ts';
import ckb from '@e07/trail-clear/i18n/ckb.json';
import de from '@e07/trail-clear/i18n/de.json';
import en from '@e07/trail-clear/i18n/en.json';
import fa from '@e07/trail-clear/i18n/fa.json';
import { applyMove } from '@e07/trail-clear/rules/apply-move.ts';
import { intentToMove } from '@e07/trail-clear/rules/intent-to-move.ts';
import { listMoves } from '@e07/trail-clear/rules/list-moves.ts';
import { outcome } from '@e07/trail-clear/rules/outcome.ts';
import { parseState } from '@e07/trail-clear/rules/trail-clear-persistence.ts';

import { TRAIL_CLEAR_TEACHING } from './trail-clear-teaching.ts';

import type { TutorialPointer } from '@e07/game-kit/contract/teaching.ts';
import type { BoardTarget } from '@e07/game-kit/geom/board-layout.ts';
import type {
  TrailClearEvent,
  TrailClearMove,
  TrailClearState,
} from '@e07/trail-clear/rules/trail-clear-types.ts';

const CATALOGS: readonly Readonly<Record<string, string>>[] = [en, de, fa, ckb];
const PHONE = { width: 374, height: 660 };

/** Every target a pointer names is a slot or a cell the phone layout draws. */
function isOnBoard(state: TrailClearState, pointer: TutorialPointer): boolean {
  const layout = layoutBoard({
    ...PHONE,
    view: toView(state, { formatNumber: String }),
    isMirrored: false,
  });
  const isDrawn = (target: BoardTarget): boolean => cellRect(layout, target) !== null;
  switch (pointer.kind) {
    case 'target':
      return isDrawn(pointer.target);
    case 'drag':
      return pointer.from.regionId === 'tray' && isDrawn(pointer.from) && isDrawn(pointer.to);
    case 'hud':
    case 'none':
      return true;
  }
}

/** The tutorial played step by step: each state with the step shown in it and what it did. */
function walk(): { state: TrailClearState; index: number; events: readonly TrailClearEvent[] }[] {
  const { start, steps } = TRAIL_CLEAR_TEACHING.tutorial;
  const seen: { state: TrailClearState; index: number; events: readonly TrailClearEvent[] }[] = [];
  let state = start;
  steps.forEach((step, index) => {
    if (step.expect.kind !== 'move') throw new Error('every step expects a move');
    const result = applyMove(state, step.expect.move);
    seen.push({ state, index, events: result.events });
    state = result.state;
  });
  return seen;
}

function movesOf(): TrailClearMove[] {
  return TRAIL_CLEAR_TEACHING.tutorial.steps.map((step) => {
    if (step.expect.kind !== 'move') throw new Error('every step expects a move');
    return step.expect.move;
  });
}

describe('TRAIL_CLEAR_TEACHING', () => {
  it('scripts four steps, each expecting one legal move, and the scripted moves win', () => {
    const { start, steps } = TRAIL_CLEAR_TEACHING.tutorial;
    expect(steps).toHaveLength(4);
    const end = movesOf().reduce((state, move) => {
      expect(listMoves(state)).toContainEqual(move);
      return applyMove(state, move).state;
    }, start);
    expect(outcome(end)).toStrictEqual({ kind: 'won', score: 250 });
  });

  it('points the hand along the drag that plays exactly the expected move', () => {
    for (const { state, index } of walk()) {
      const step = TRAIL_CLEAR_TEACHING.tutorial.steps[index];
      if (step?.pointer.kind !== 'drag' || step.expect.kind !== 'move') {
        throw new Error('every step drags');
      }
      const intent = { kind: 'drag-end', from: step.pointer.from, to: step.pointer.to } as const;
      expect(intentToMove(state, intent)).toStrictEqual(step.expect.move);
      expect(isOnBoard(state, step.pointer)).toBe(true);
    }
  });

  it('joins the road, turns a bend, then closes the road and clears its five tiles', () => {
    const kinds = walk().map(({ events }) => events.map((event) => event.kind));
    expect(kinds.slice(0, 2)).toStrictEqual([
      ['tile-placed', 'tile-dealt'],
      ['tile-placed', 'tile-dealt'],
    ]);
    expect(kinds[2]).toStrictEqual([
      'tile-placed',
      'loop-closed',
      'tiles-wiped',
      'score-added',
      'tile-dealt',
    ]);
    const wiped = walk()[2]?.events.find((event) => event.kind === 'tiles-wiped');
    expect(wiped?.kind === 'tiles-wiped' ? wiped.cells.length : 0).toBe(5);
    expect(movesOf()[1]?.turns).not.toBe(0);
  });

  it('starts from a run a saved game would accept', () => {
    const { start } = TRAIL_CLEAR_TEACHING.tutorial;
    expect(parseState(JSON.parse(JSON.stringify(start)))).toStrictEqual(start);
  });

  it('teaches in 3 to 5 how-to-play pages drawn from playing examples', () => {
    const pages = TRAIL_CLEAR_TEACHING.howToPlay;
    expect(pages.length).toBeGreaterThanOrEqual(3);
    expect(pages.length).toBeLessThanOrEqual(5);
    expect(pages.every((page) => outcome(page.example).kind === 'playing')).toBe(true);
    expect(pages.every((page) => isOnBoard(page.example, page.pointer))).toBe(true);
  });

  it('shows on each how-to-play page a drag the board would play', () => {
    for (const page of TRAIL_CLEAR_TEACHING.howToPlay) {
      if (page.pointer.kind !== 'drag') throw new Error('every page drags');
      const intent = { kind: 'drag-end', from: page.pointer.from, to: page.pointer.to } as const;
      expect(intentToMove(page.example, intent)).not.toBeNull();
    }
  });

  it('closes a road and a river with one tile on the last page', () => {
    const page = TRAIL_CLEAR_TEACHING.howToPlay.at(-1);
    if (page?.pointer.kind !== 'drag') throw new Error('the last page drags');
    const intent = { kind: 'drag-end', from: page.pointer.from, to: page.pointer.to } as const;
    const move = intentToMove(page.example, intent);
    if (move === null) throw new Error('the drag plays');
    const kinds = applyMove(page.example, move).events.map((event) => event.kind);
    expect(kinds).toContain('double-closed');
  });

  it('names only keys that are in all four catalogs', () => {
    const { tutorial, howToPlay } = TRAIL_CLEAR_TEACHING;
    const keys = [
      ...tutorial.steps.map((step) => step.messageId),
      ...howToPlay.flatMap((page) => [page.titleId, page.bodyId]),
    ];
    const missing = keys.filter((key) => CATALOGS.some((catalog) => catalog[key] === undefined));
    expect(missing).toStrictEqual([]);
  });
});
