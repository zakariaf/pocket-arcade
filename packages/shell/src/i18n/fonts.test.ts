// packages/shell/src/i18n/fonts.test.ts
import { scriptFontFor } from './fonts.ts';

describe('scriptFontFor', () => {
  it.each([
    { language: 'en', weight: 'regular', face: 'display', family: 'LilitaOne' },
    { language: 'de', weight: 'bold', face: 'text', family: 'Rubik-Bold' },
    { language: 'en', weight: 'regular', face: 'text', family: 'Rubik-Regular' },
    { language: 'fa', weight: 'regular', face: 'display', family: 'Vazirmatn-Bold' },
    { language: 'ckb', weight: 'bold', face: 'text', family: 'Vazirmatn-Bold' },
    { language: 'fa', weight: 'regular', face: 'text', family: 'Vazirmatn-Regular' },
    { language: 'ckb', weight: 'regular', face: 'brand', family: 'LilitaOne' },
  ] as const)('picks $family for $language $face $weight', ({ language, weight, face, family }) => {
    expect(scriptFontFor(language, weight, face).fontFamily).toBe(family);
  });
});
