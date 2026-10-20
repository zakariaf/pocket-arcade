// apps/scrap-shove/src/tutorial/scrap-shove-teaching.test.ts
import { scrapShoveBoard } from '@e07/scrap-shove/board/scrap-shove-board.ts';
import ckb from '@e07/scrap-shove/i18n/ckb.json';
import de from '@e07/scrap-shove/i18n/de.json';
import en from '@e07/scrap-shove/i18n/en.json';
import fa from '@e07/scrap-shove/i18n/fa.json';
import { applyMove } from '@e07/scrap-shove/rules/apply-move.ts';
import { boardText } from '@e07/scrap-shove/rules/board-text.ts';
import { listMoves } from '@e07/scrap-shove/rules/list-moves.ts';
import { outcome } from '@e07/scrap-shove/rules/outcome.ts';

import { SCRAP_SHOVE_TEACHING } from './scrap-shove-teaching.ts';

import type { TutorialPointer } from '@e07/game-kit/contract/teaching.ts';
import type { ScrapShoveMove, ScrapShoveState } from '@e07/scrap-shove/rules/scrap-shove-types.ts';

const { tutorial, howToPlay } = SCRAP_SHOVE_TEACHING;

/** The move each tutorial step expects (every step names exactly one). */
function expectedMoves(): ScrapShoveMove[] {
  return tutorial.steps.map((step) => {
    if (step.expect.kind !== 'move') throw new Error(`${step.messageId} expects no single move`);
    return step.expect.move;
  });
}

/** The states the tutorial passes through: the start, then after each expected move. */
function tutorialStates(): ScrapShoveState[] {
  return expectedMoves().reduce(
    (states, move) => [...states, applyMove(states.at(-1) ?? tutorial.start, move).state],
    [tutorial.start],
  );
}

function isOnFloor(pointer: TutorialPointer, state: ScrapShoveState): boolean {
  if (pointer.kind !== 'target') return pointer.kind === 'none';
  const { regionId, col, row } = pointer.target;
  return regionId === 'board' && col >= 0 && row >= 0 && col < state.cols && row < state.rows;
}

describe('SCRAP_SHOVE_TEACHING tutorial', () => {
  it('starts from a fixed floor: two robots that will crash, one to crush, and scrap (spec S13)', () => {
    expect(boardText(tutorial.start, tutorial.start.cols).split('\n')).toStrictEqual([
      '........',
      '........',
      '.nn.....',
      '..n.....',
      '........',
      '.....#@.',
      '.....#..',
      '........',
    ]);
  });

  it('expects one legal move per step, pointed at on the floor where the board puts that move', () => {
    const states = tutorialStates();
    tutorial.steps.forEach((step, index) => {
      const state = states[index] ?? tutorial.start;
      const move = expectedMoves()[index] ?? { kind: 'wait' };
      expect(listMoves(state)).toContainEqual(move);
      expect(isOnFloor(step.pointer, state)).toBe(true);
      const target = step.pointer.kind === 'target' ? [step.pointer.target] : [];
      expect(target).toStrictEqual(scrapShoveBoard.targetsOfMove?.(state, move));
    });
  });

  it('steps, steps again, lets two robots crash, then shoves scrap onto the last robot to win', () => {
    const states = tutorialStates();
    const kinds = expectedMoves().map((move, index) =>
      applyMove(states[index] ?? tutorial.start, move).events.map((event) => event.kind),
    );
    expect(kinds.map((events) => events.filter((kind) => kind !== 'robots-stepped'))).toStrictEqual(
      [
        ['player-stepped'],
        ['player-stepped'],
        ['player-stepped', 'robots-crashed'],
        ['player-stepped', 'scrap-shoved', 'robot-crushed', 'floor-cleared'],
      ],
    );
    expect(outcome(states.at(-1) ?? tutorial.start).kind).toBe('won');
  });
});

describe('SCRAP_SHOVE_TEACHING how to play', () => {
  it('teaches in 3 to 5 pages, each a playing floor the board can draw', () => {
    expect(howToPlay.length).toBeGreaterThanOrEqual(3);
    expect(howToPlay.length).toBeLessThanOrEqual(5);
    expect(howToPlay.every((page) => outcome(page.example).kind === 'playing')).toBe(true);
    const views = howToPlay.map((page) =>
      scrapShoveBoard.toView(page.example, { formatNumber: String }),
    );
    expect(views.every((view) => view.cols === 8 && view.rows === 8)).toBe(true);
    expect(howToPlay.every((page) => isOnFloor(page.pointer, page.example))).toBe(true);
  });

  it('points at a square next to the player, then at scrap the player can shove', () => {
    const [stepPage, shovePage] = howToPlay;
    const pointed = [stepPage, shovePage].map((page) => {
      if (page?.pointer.kind !== 'target') throw new Error('a page without a target');
      const { col, row } = page.pointer.target;
      return listMoves(page.example).find(
        (move) => move.kind !== 'wait' && move.col === col && move.row === row,
      )?.kind;
    });
    expect(pointed).toStrictEqual(['step', 'shove']);
  });
});

describe('SCRAP_SHOVE_TEACHING texts', () => {
  const CATALOGS = { en, de, fa, ckb } as const;
  const keys = [
    ...tutorial.steps.map((step) => step.messageId),
    ...howToPlay.flatMap((page) => [page.titleId, page.bodyId]),
  ];

  it.each(Object.keys(CATALOGS) as (keyof typeof CATALOGS)[])(
    'has every tutorial and how-to-play key in the %s catalog',
    (language) => {
      const catalog: Readonly<Record<string, string>> = CATALOGS[language];
      expect(keys.filter((key) => catalog[key] === undefined)).toStrictEqual([]);
    },
  );

  it('uses the four tutorial steps and the four how-to-play pages of the copy deck', () => {
    expect(new Set(keys)).toStrictEqual(
      new Set([
        'scrap-shove.goal',
        ...[1, 2, 3, 4].map((n) => `scrap-shove.tutorial.step-${String(n)}`),
        ...[1, 2, 3, 4].map((n) => `scrap-shove.how-to-play.step-${String(n)}`),
      ]),
    );
  });
});
