// packages/shell/src/i18n/direction-plan.test.ts
import fc from 'fast-check';

import { languageFromRawSave, planDirection } from './direction-plan.ts';
import { directionOf, LANGUAGES } from './languages.ts';

import type { Direction } from './languages.ts';

const ANY_DIRECTION = fc.constantFrom<Direction>('ltr', 'rtl');
const ANY_INPUT = fc.record({
  language: fc.constantFrom(...LANGUAGES),
  layout: ANY_DIRECTION,
  pendingRestart: fc.option(ANY_DIRECTION),
});

describe('planDirection', () => {
  it.each([
    { language: 'fa', layout: 'rtl', pendingRestart: null, plan: 'keep' },
    { language: 'en', layout: 'ltr', pendingRestart: 'rtl', plan: 'keep' },
    { language: 'fa', layout: 'ltr', pendingRestart: null, plan: 'restart' },
    { language: 'de', layout: 'rtl', pendingRestart: 'rtl', plan: 'restart' },
    { language: 'ckb', layout: 'ltr', pendingRestart: 'rtl', plan: 'give-up' },
    { language: 'en', layout: 'rtl', pendingRestart: 'ltr', plan: 'give-up' },
  ] as const)(
    'returns $plan for $language on a $layout layout (pending: $pendingRestart)',
    ({ plan, ...input }) => {
      expect(planDirection(input)).toBe(plan);
    },
  );

  it('keeps the layout whenever it already matches the language (spec 7.5)', () => {
    fc.assert(
      fc.property(ANY_INPUT, (input) => {
        fc.pre(directionOf(input.language) === input.layout);
        expect(planDirection(input)).toBe('keep');
      }),
    );
  });

  it('restarts at most once for the same direction (spec 7.5)', () => {
    fc.assert(
      fc.property(ANY_INPUT, (input) => {
        fc.pre(input.pendingRestart === directionOf(input.language));
        expect(planDirection(input)).not.toBe('restart');
      }),
    );
  });
});

describe('languageFromRawSave', () => {
  it('reads the saved language from an unvalidated save document', () => {
    expect(languageFromRawSave({ settings: { language: 'ckb' } })).toBe('ckb');
  });

  it.each([null, 42, 'fa', {}, { settings: null }, { settings: { language: 'xx' } }])(
    'returns null for %j instead of throwing',
    (raw) => {
      expect(languageFromRawSave(raw)).toBeNull();
    },
  );
});
