// packages/game-kit/src/testing/teaching-contract.test.ts
// Spec S13, 8.6 and N10: a tutorial interrupted by a kill comes back where it was, like any run.
import fc from 'fast-check';

import { tutorialSaveProblems, tutorialStates } from './teaching-contract.ts';

import type { TutorialSaveInput } from './teaching-contract.ts';
import type { TutorialStep } from '@e07/game-kit/contract/teaching.ts';

/** Toy game: add 1 or 2 to a count; nothing can be added once it reaches 6. */
type Count = { readonly count: number; readonly adds: number };
type Add = { readonly kind: 'add'; readonly by: number };

const ENGINE: TutorialSaveInput<Count, Add, never>['engine'] = {
  listMoves: (state) =>
    state.count >= 6
      ? []
      : [
          { kind: 'add', by: 1 },
          { kind: 'add', by: 2 },
        ],
  applyMove: (state, move) => ({
    state: { count: state.count + move.by, adds: state.adds + 1 },
    events: [],
  }),
};

const isCount = (json: unknown): json is Count =>
  typeof json === 'object' &&
  json !== null &&
  typeof Reflect.get(json, 'count') === 'number' &&
  typeof Reflect.get(json, 'adds') === 'number';

/** A parser that reads back runs up to `most` and refuses the rest, as a reachability check does. */
function parseUpTo(most: number) {
  return (json: unknown): Count | null =>
    isCount(json) && json.count <= most ? { count: json.count, adds: json.adds } : null;
}

const step = (by: number): TutorialStep<Add> => ({
  messageId: 'toy.tutorial.step',
  pointer: { kind: 'none' },
  expect: { kind: 'move', move: { kind: 'add', by } },
});
const ANY: TutorialStep<Add> = {
  messageId: 'toy.tutorial.any',
  pointer: { kind: 'none' },
  expect: { kind: 'any-move' },
};

function inputFor(
  steps: readonly TutorialStep<Add>[],
  parseState: (json: unknown) => Count | null,
): TutorialSaveInput<Count, Add, never> {
  return {
    teaching: { tutorial: { start: { count: 0, adds: 0 }, steps } },
    engine: ENGINE,
    persistence: { parseState },
  };
}

describe('tutorialStates', () => {
  it('plays the start, each scripted move and the first legal move of an any-move step', () => {
    expect(tutorialStates(inputFor([step(2), ANY, step(2)], parseUpTo(99)))).toStrictEqual([
      { count: 0, adds: 0 },
      { count: 2, adds: 1 },
      { count: 3, adds: 2 },
      { count: 5, adds: 3 },
    ]);
  });

  it('stops at an any-move step that has no legal move', () => {
    const states = tutorialStates(inputFor([step(2), step(2), step(2), ANY, ANY], parseUpTo(99)));
    expect(states.map((state) => state.count)).toStrictEqual([0, 2, 4, 6]);
  });
});

describe('tutorialSaveProblems', () => {
  it('finds nothing when parseState reads every tutorial state back unchanged', () => {
    expect(tutorialSaveProblems(inputFor([step(1), ANY, step(2)], parseUpTo(99)))).toStrictEqual(
      [],
    );
  });

  it('names each tutorial state parseState refuses (a kill there would drop the run)', () => {
    expect(tutorialSaveProblems(inputFor([step(2), step(2), step(1)], parseUpTo(2)))).toStrictEqual(
      [
        'the state after tutorial step 2: parseState does not return the saved state unchanged',
        'the state after tutorial step 3: parseState does not return the saved state unchanged',
      ],
    );
  });

  it('names a refused start, and a state read back with its keys in another order', () => {
    const reordered = (json: unknown): Count | null =>
      isCount(json) ? { adds: json.adds, count: json.count } : null;
    expect(tutorialSaveProblems(inputFor([], parseUpTo(-1)))).toStrictEqual([
      'the tutorial start: parseState does not return the saved state unchanged',
    ]);
    expect(tutorialSaveProblems(inputFor([step(1)], reordered))).toHaveLength(2);
  });

  it('flags exactly the states above what parseState reads back (property)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 2 }), { maxLength: 8 }),
        fc.integer({ min: 0, max: 8 }),
        (adds, most) => {
          const input = inputFor(adds.map(step), parseUpTo(most));
          const above = tutorialStates(input).filter((state) => state.count > most);
          expect(tutorialSaveProblems(input)).toHaveLength(above.length);
        },
      ),
    );
  });
});
