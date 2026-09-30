// packages/shell/src/i18n/direction-plan.test.ts
import { languageFromRawSave, planDirection } from './direction-plan.ts';

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
