// packages/game-kit/src/testing/json-shape.test.ts
import { jsonShapeProblems } from './json-shape.ts';

describe('jsonShapeProblems', () => {
  it('accepts plain objects, arrays, strings, finite numbers, booleans and null', () => {
    const state = { cells: [0, 1], name: 'a', isOver: false, rng: [1, 2, 3, 4], last: null };
    expect(jsonShapeProblems(state)).toStrictEqual([]);
  });

  it.each([
    [{ hp: undefined }, 'state.hp is undefined (JSON drops it)'],
    [{ hp: Number.POSITIVE_INFINITY }, 'state.hp is Infinity'],
    [{ seen: new Set([1]) }, 'state.seen is a Set, not a plain object'],
    [{ body: new Float32Array(2) }, 'state.body is a Float32Array, not a plain object'],
    [{ list: [1, () => 2] }, 'state.list[1] is a function'],
  ])('reports %j', (state, problem) => {
    expect(jsonShapeProblems(state)).toStrictEqual([problem]);
  });
});
