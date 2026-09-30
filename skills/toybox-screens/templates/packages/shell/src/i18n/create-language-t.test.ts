// packages/shell/src/i18n/create-language-t.test.ts
// no-shell-context: a pure factory over the Shell catalogs.
import { createLanguageT } from './create-language-t.ts';

function throwError(error: Error): never {
  throw error;
}

describe('createLanguageT', () => {
  it('speaks the chosen language, whatever the app language is', () => {
    const key = 'language-choice.continue-button';
    expect(createLanguageT('en', 'automatic', throwError)(key)).toBe('Continue');
    expect(createLanguageT('de', 'automatic', throwError)(key)).toBe('Weiter');
  });

  it('writes numbers in the chosen digits', () => {
    const t = createLanguageT('fa', 'automatic', throwError);
    expect(t('game-screen.mode.level', { level: 12 })).toContain('۱۲');
  });
});
