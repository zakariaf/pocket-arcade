// __TEST_FILE_PATH__
// Spec __SPEC_ID__: "__SPEC_QUOTE__"
// Order inside the file: examples (the spec sentences, with at least one pinned exact value), a
// table for the rule matrix, the impossible inputs, then fast-check properties.
import fc from 'fast-check';

import { __UNIT_NAME__ } from './__MODULE_FILE__.ts';

// Drop this import when the result is a number, string or boolean.
import type { __RESULT_TYPE__ } from './__MODULE_FILE__.ts';

const inputArb = __INPUT_ARBITRARY__;

/** True when a result keeps the unit's invariant (checked by the property below). */
function __INVARIANT_NAME__(result: __RESULT_TYPE__): boolean {
  return __INVARIANT_EXPRESSION__;
}

describe('__UNIT_NAME__', () => {
  // Pinned exact value. __EQUALITY_MATCHER__ is toBe for a number, string or boolean literal
  // (ESLint's jest/prefer-to-be rejects toStrictEqual there) and toStrictEqual for an object or array.
  it('__EXAMPLE_TITLE__ (spec __SPEC_ID__)', () => {
    expect(__UNIT_NAME__(__EXAMPLE_INPUT__)).__EQUALITY_MATCHER__(__EXAMPLE_OUTPUT__);
  });

  it.each(__RULE_TABLE__)('__TABLE_TITLE__ %p', (input, expected) => {
    expect(__UNIT_NAME__(input)).toStrictEqual(expected);
  });

  describe('when the input is impossible', () => {
    it('throws a RangeError', () => {
      expect(() => __UNIT_NAME__(__IMPOSSIBLE_INPUT__)).toThrow(RangeError);
    });
  });

  describe('properties', () => {
    it('returns the same result for the same input', () => {
      fc.assert(
        fc.property(inputArb, (input) => {
          expect(__UNIT_NAME__(input)).toStrictEqual(__UNIT_NAME__(input));
        }),
      );
    });

    it('__INVARIANT_TITLE__', () => {
      fc.assert(
        fc.property(inputArb, (input) => {
          expect(__INVARIANT_NAME__(__UNIT_NAME__(input))).toBe(true);
        }),
      );
    });
  });
});
