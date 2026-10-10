// packages/shell/src/screens/settings/language/language-change.test.ts
import { planLanguageChange } from './language-change.ts';

const ENGLISH_PHONE = [{ languageCode: 'en', languageScriptCode: null }];
const PERSIAN_PHONE = [{ languageCode: 'fa', languageScriptCode: null }];

describe('planLanguageChange', () => {
  it('switches the text at once when the direction stays the same', () => {
    const change = planLanguageChange({
      next: 'de',
      deviceLocales: ENGLISH_PHONE,
      layoutDirection: 'ltr',
    });
    expect(change).toStrictEqual({
      action: { type: 'set-language', language: 'de' },
      resolved: 'de',
      needsRestart: false,
    });
  });

  it('asks for a restart when the new language reads the other way', () => {
    const change = planLanguageChange({
      next: 'ckb',
      deviceLocales: ENGLISH_PHONE,
      layoutDirection: 'ltr',
    });
    expect(change.needsRestart).toBe(true);
  });

  it('resolves System against the phone before comparing directions', () => {
    const change = planLanguageChange({
      next: null,
      deviceLocales: PERSIAN_PHONE,
      layoutDirection: 'ltr',
    });
    expect(change.resolved).toBe('fa');
    expect(change.needsRestart).toBe(true);
    expect(change.action).toStrictEqual({ type: 'set-language', language: null });
  });
});
