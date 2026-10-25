// apps/snare-snake/src/tutorial/snare-snake-teaching.test.ts
// Spec 2.1 and S13: the game teaches itself in its first level, one short sentence and one pointer
// at a time, every expected move legal; How to play has 3 to 5 pages drawn by the game's board.
import ckb from '@e07/snare-snake/i18n/ckb.json';
import de from '@e07/snare-snake/i18n/de.json';
import en from '@e07/snare-snake/i18n/en.json';
import fa from '@e07/snare-snake/i18n/fa.json';
import { applyMove } from '@e07/snare-snake/rules/apply-move.ts';
import { touchingCells } from '@e07/snare-snake/rules/board-grid.ts';
import { listMoves } from '@e07/snare-snake/rules/list-moves.ts';
import { outcome } from '@e07/snare-snake/rules/outcome.ts';

import { SNARE_SNAKE_TEACHING } from './snare-snake-teaching.ts';

import type { TutorialPointer } from '@e07/game-kit/contract/teaching.ts';
import type { SnareSnakeState } from '@e07/snare-snake/rules/snare-snake-types.ts';

const { tutorial, howToPlay } = SNARE_SNAKE_TEACHING;
const CATALOGS: readonly Readonly<Record<string, string>>[] = [en, de, fa, ckb];

/** The cells a pointer names (a target, or both ends of a drag). */
function pointedCells(pointer: TutorialPointer): { col: number; row: number }[] {
  if (pointer.kind === 'target') return [pointer.target];
  return pointer.kind === 'drag' ? [pointer.from, pointer.to] : [];
}

/** True when every pointed cell lies on the board of `state`. */
function isOnBoard(state: SnareSnakeState, pointer: TutorialPointer): boolean {
  return pointedCells(pointer).every(
    (cell) => cell.col >= 0 && cell.row >= 0 && cell.col < state.cols && cell.row < state.rows,
  );
}

/** The states the tutorial passes through: its start, then one after each scripted move. */
function tutorialStates(): SnareSnakeState[] {
  const states = [tutorial.start];
  for (const step of tutorial.steps) {
    const state = states.at(-1) ?? tutorial.start;
    if (step.expect.kind === 'move') states.push(applyMove(state, step.expect.move).state);
  }
  return states;
}

describe('SNARE_SNAKE_TEACHING', () => {
  it('teaches in 3 to 5 how-to-play pages drawn from playing examples', () => {
    expect(howToPlay.length).toBeGreaterThanOrEqual(3);
    expect(howToPlay.length).toBeLessThanOrEqual(5);
    expect(howToPlay.every((page) => outcome(page.example).kind === 'playing')).toBe(true);
    expect(howToPlay.every((page) => isOnBoard(page.example, page.pointer))).toBe(true);
  });

  it('expects a legal move at each scripted step, the pointer on the cell the head enters', () => {
    const states = tutorialStates();
    const scripted = tutorial.steps.filter((step) => step.expect.kind === 'move');
    expect(scripted).toHaveLength(3);
    scripted.forEach((step, index) => {
      const state = states[index] ?? tutorial.start;
      if (step.expect.kind !== 'move') return;
      expect(listMoves(state)).toContainEqual(step.expect.move);
      const head = (states[index + 1] ?? state).snake[0] ?? -1;
      expect(step.pointer).toStrictEqual({
        kind: 'target',
        target: { regionId: 'board', col: head % state.cols, row: Math.floor(head / state.cols) },
      });
    });
  });

  it('closes a loop on the third step that snares the critters beside it', () => {
    const states = tutorialStates();
    const third = tutorial.steps[2];
    if (third?.expect.kind !== 'move') throw new Error('the third step expects a move');
    const kinds = applyMove(states[2] ?? tutorial.start, third.expect.move).events.map(
      (event) => event.kind,
    );
    expect(kinds).toStrictEqual(['loop-closed', 'critters-caught']);
  });

  it('ends on a clear next step: critters left to catch, any move to make', () => {
    const last = tutorial.steps.at(-1);
    const end = tutorialStates().at(-1) ?? tutorial.start;
    expect(tutorial.steps).toHaveLength(4);
    expect(last?.expect).toStrictEqual({ kind: 'any-move' });
    expect(outcome(end).kind).toBe('playing');
    expect(end.critters.length).toBeGreaterThan(0);
    expect(listMoves(end).length).toBeGreaterThan(0);
  });

  it('points page 2 at a critter frozen beside the snake', () => {
    const page = howToPlay[1];
    if (page?.pointer.kind !== 'target') throw new Error('page 2 points at a critter');
    const { col, row } = page.pointer.target;
    const cell = row * page.example.cols + col;
    expect(page.example.critters.map((critter) => critter.cell)).toContain(cell);
    expect(touchingCells(page.example, page.example.snake).has(cell)).toBe(true);
  });

  it('names only keys that exist in all four catalogs', () => {
    const keys = [
      ...tutorial.steps.map((step) => step.messageId),
      ...howToPlay.flatMap((page) => [page.titleId, page.bodyId]),
    ];
    expect(CATALOGS.map((catalog) => keys.filter((key) => !(key in catalog)))).toStrictEqual([
      [],
      [],
      [],
      [],
    ]);
  });
});
