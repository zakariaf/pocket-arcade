// apps/poker-drop/src/tutorial/poker-drop-teaching.test.ts
import fc from 'fast-check';

import ckb from '@e07/poker-drop/i18n/ckb.json';
import de from '@e07/poker-drop/i18n/de.json';
import en from '@e07/poker-drop/i18n/en.json';
import fa from '@e07/poker-drop/i18n/fa.json';
import { applyMove } from '@e07/poker-drop/rules/apply-move.ts';
import { create } from '@e07/poker-drop/rules/create.ts';
import { listMoves } from '@e07/poker-drop/rules/list-moves.ts';
import { outcome } from '@e07/poker-drop/rules/outcome.ts';
import { parseState } from '@e07/poker-drop/rules/poker-drop-persistence.ts';

import { POKER_DROP_TEACHING } from './poker-drop-teaching.ts';

import type { TutorialPointer } from '@e07/game-kit/contract/teaching.ts';
import type { PokerDropState } from '@e07/poker-drop/rules/poker-drop-types.ts';

const { tutorial, howToPlay } = POKER_DROP_TEACHING;
const CATALOGS = { en, de, fa, ckb } as const;
/** The well is 5 columns by 6 rows; a pointer's row counts from the top, as hit tests do. */
const isInWell = (pointer: TutorialPointer): boolean =>
  pointer.kind !== 'target' ||
  (pointer.target.regionId === 'well' &&
    pointer.target.col >= 0 &&
    pointer.target.col < 5 &&
    pointer.target.row >= 0 &&
    pointer.target.row < 6);

/** The tutorial's run: the scripted move where a step names one, else the chosen column. */
function playScript(choices: readonly number[]): PokerDropState[] {
  const states = [tutorial.start];
  tutorial.steps.forEach((step, index) => {
    const state = states[states.length - 1] ?? tutorial.start;
    const moves = listMoves(state);
    const move =
      step.expect.kind === 'move' ? step.expect.move : moves[(choices[index] ?? 0) % moves.length];
    if (move === undefined) throw new Error(`step ${String(index + 1)} has no legal move`);
    states.push(applyMove(state, move).state);
  });
  return states;
}

describe('POKER_DROP_TEACHING', () => {
  // Spec S13: "a scripted first level ... one short sentence at a time, no text wall".
  it('starts from the fixed opening of seed 1 at difficulty 0', () => {
    expect(tutorial.start).toStrictEqual(create(1, 0));
  });

  it('opens with one expected drop into the gap, legal there, that bursts two pair and cascades', () => {
    const [first] = tutorial.steps;
    if (first?.expect.kind !== 'move') throw new Error('the first step expects a move');
    expect(first.expect.move).toStrictEqual({ kind: 'drop-card', col: 4 });
    expect(listMoves(tutorial.start)).toContainEqual(first.expect.move);
    expect(first.pointer).toStrictEqual({
      kind: 'target',
      target: { regionId: 'well', col: 4, row: 5 },
    });
    const bursts = applyMove(tutorial.start, first.expect.move).events.flatMap((event) =>
      event.kind === 'hand-burst' ? [[event.hand, event.step]] : [],
    );
    expect(bursts).toStrictEqual([
      ['two-pair', 1],
      ['two-pair', 2],
    ]);
  });

  it('scripts four steps, one sentence each, with every pointer inside the well', () => {
    expect(tutorial.steps.map((step) => step.messageId)).toStrictEqual([
      'poker-drop.tutorial.step-1',
      'poker-drop.tutorial.step-2',
      'poker-drop.tutorial.step-3',
      'poker-drop.tutorial.step-4',
    ]);
    expect(tutorial.steps.every((step) => isInWell(step.pointer))).toBe(true);
    expect(howToPlay.every((page) => isInWell(page.pointer))).toBe(true);
  });

  it('ends on a clear next step: whatever columns the player picks, the run is still playing', () => {
    fc.assert(
      fc.property(fc.array(fc.nat(4), { minLength: 4, maxLength: 4 }), (choices) => {
        const states = playScript(choices);
        expect(states).toHaveLength(tutorial.steps.length + 1);
        expect(states.map((state) => outcome(state).kind)).toStrictEqual(
          states.map(() => 'playing'),
        );
      }),
    );
  });

  it('teaches in 4 how-to-play pages, each a valid playing state the board can draw', () => {
    expect(howToPlay.map((page) => page.bodyId)).toStrictEqual([
      'poker-drop.how-to-play.step-1',
      'poker-drop.how-to-play.step-2',
      'poker-drop.how-to-play.step-3',
      'poker-drop.how-to-play.step-4',
    ]);
    for (const page of howToPlay) {
      expect(outcome(page.example).kind).toBe('playing');
      expect(parseState(JSON.parse(JSON.stringify(page.example)))).toStrictEqual(page.example);
    }
  });

  it('pictures a full two-pair row, then the burst with the row above still in the air', () => {
    const full = howToPlay[1]?.example;
    const falling = howToPlay[3]?.example;
    expect(full?.cells.slice(0, 5)).toStrictEqual([48, 24, 35, 37, 20]);
    expect(falling?.cells.slice(0, 10)).toStrictEqual([
      null,
      null,
      null,
      null,
      20,
      21,
      49,
      23,
      34,
      null,
    ]);
  });

  it.each(Object.keys(CATALOGS) as (keyof typeof CATALOGS)[])(
    'finds every tutorial and how-to-play key in the %s catalog',
    (language) => {
      const catalog: Readonly<Record<string, string>> = CATALOGS[language];
      const keys = [
        ...tutorial.steps.map((step) => step.messageId),
        ...howToPlay.flatMap((page) => [page.titleId, page.bodyId]),
      ];
      expect(keys.filter((key) => catalog[key] === undefined)).toStrictEqual([]);
    },
  );
});
