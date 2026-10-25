// apps/swap-guard/src/tutorial/swap-guard-teaching.test.ts
// Spec 2.1 and S13: the game teaches itself in its first level, one short sentence and one pointer
// at a time, every expected move legal; How to play has 3 to 5 pages drawn by the game's board.
import ckb from '@e07/swap-guard/i18n/ckb.json';
import de from '@e07/swap-guard/i18n/de.json';
import en from '@e07/swap-guard/i18n/en.json';
import fa from '@e07/swap-guard/i18n/fa.json';
import { applyMove } from '@e07/swap-guard/rules/apply-move.ts';
import { listMoves } from '@e07/swap-guard/rules/list-moves.ts';
import { outcome } from '@e07/swap-guard/rules/outcome.ts';
import { strikesOf, struckSquares } from '@e07/swap-guard/rules/strikes.ts';

import { SWAP_GUARD_TEACHING } from './swap-guard-teaching.ts';

import type { TutorialPointer } from '@e07/game-kit/contract/teaching.ts';
import type { SwapGuardEvent, SwapGuardState } from '@e07/swap-guard/rules/swap-guard-types.ts';

const { tutorial, howToPlay } = SWAP_GUARD_TEACHING;
const CATALOGS: readonly Readonly<Record<string, string>>[] = [en, de, fa, ckb];

/** The square a pointer names, or null for a pointer without one. */
function pointedCell(state: SwapGuardState, pointer: TutorialPointer): number | null {
  if (pointer.kind !== 'target') return null;
  const { col, row } = pointer.target;
  const isOnBoard = col >= 0 && row >= 0 && col < state.size && row < state.size;
  return isOnBoard ? row * state.size + col : -1;
}

/** The states and events the tutorial passes through: its start, then each scripted move. */
function tutorialRun(): { states: SwapGuardState[]; events: SwapGuardEvent[][] } {
  const states = [tutorial.start];
  const events: SwapGuardEvent[][] = [];
  for (const step of tutorial.steps) {
    const state = states.at(-1) ?? tutorial.start;
    if (step.expect.kind !== 'move') continue;
    const result = applyMove(state, step.expect.move);
    states.push(result.state);
    events.push([...result.events]);
  }
  return { states, events };
}

describe('SWAP_GUARD_TEACHING', () => {
  it('starts from a playing board with the guard standing in a strike (the opening)', () => {
    expect(outcome(tutorial.start).kind).toBe('playing');
    expect(struckSquares(strikesOf(tutorial.start)).has(tutorial.start.guard)).toBe(true);
  });

  it('expects a legal swap at each of the four steps, the pointer on the square swapped to', () => {
    const { states } = tutorialRun();
    expect(tutorial.steps).toHaveLength(4);
    tutorial.steps.forEach((step, index) => {
      const state = states[index] ?? tutorial.start;
      if (step.expect.kind !== 'move') throw new Error('every step expects one swap');
      expect(listMoves(state)).toContainEqual(step.expect.move);
      expect(pointedCell(state, step.pointer)).toBe(step.expect.move.cell);
    });
  });

  it('knocks out two enemies with the first swap: the double hit', () => {
    const { events } = tutorialRun();
    const defeated = events[0]?.find((event) => event.kind === 'enemies-defeated');
    expect(defeated?.kind === 'enemies-defeated' ? defeated.enemyIds : []).toHaveLength(2);
  });

  it('steps onto an empty tile, swaps in front of the last enemy, then wins as it walks into its own strike', () => {
    const { states, events } = tutorialRun();
    expect(events[1]?.[0]).toMatchObject({ kind: 'pieces-swapped', enemyId: null });
    expect(events[2]?.[0]).toMatchObject({ kind: 'pieces-swapped', enemyId: 2 });
    const third = states[3] ?? tutorial.start;
    expect(struckSquares(strikesOf(third)).has(third.guard)).toBe(true);
    expect(outcome(states.at(-1) ?? tutorial.start).kind).toBe('won');
  });

  it('teaches in 3 to 5 how-to-play pages drawn from playing examples, pointing on the board', () => {
    expect(howToPlay.length).toBeGreaterThanOrEqual(3);
    expect(howToPlay.length).toBeLessThanOrEqual(5);
    expect(howToPlay.every((page) => outcome(page.example).kind === 'playing')).toBe(true);
    expect(howToPlay.every((page) => pointedCell(page.example, page.pointer) !== -1)).toBe(true);
  });

  it('points page 1 at a shaded square and page 3 at an enemy standing on one', () => {
    const [first, , third] = howToPlay;
    if (first === undefined || third === undefined) throw new Error('pages expected');
    const shaded = struckSquares(strikesOf(first.example));
    expect(shaded.has(pointedCell(first.example, first.pointer) ?? -1)).toBe(true);
    const cell = pointedCell(third.example, third.pointer) ?? -1;
    expect(third.example.enemies.map((enemy) => enemy.cell)).toContain(cell);
    expect(struckSquares(strikesOf(third.example)).has(cell)).toBe(true);
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
