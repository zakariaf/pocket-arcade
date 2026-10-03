// packages/shell/src/art/credit-rows.test.ts
import { creditRowsOf } from './credit-rows.ts';

import type { CreditEntry } from './credit-entry.ts';

const WORD_LIST: CreditEntry = {
  kind: 'word-list',
  name: 'ENABLE Word List (2nd ed.)',
  version: '2.0',
  license: 'LicenseRef-Public-Domain',
  copyright: 'Alan Beale and M. Cooper',
  source: 'norvig.com/ngrams/enable1.txt',
};

describe('creditRowsOf', () => {
  it('turns each credit into one S11d row with a game- key', () => {
    expect(creditRowsOf([WORD_LIST])).toStrictEqual([
      {
        key: 'game-enable-word-list-2nd-ed',
        group: 'software',
        name: 'ENABLE Word List (2nd ed.)',
        version: '2.0',
        licence: 'LicenseRef-Public-Domain',
      },
    ]);
  });

  it('files fonts and sounds under their own groups', () => {
    const font: CreditEntry = { ...WORD_LIST, kind: 'font', name: 'Pixel Sans' };
    const sound: CreditEntry = { ...WORD_LIST, kind: 'sound', name: 'Bell' };
    expect(creditRowsOf([font, sound]).map((row) => [row.key, row.group])).toStrictEqual([
      ['game-pixel-sans', 'fonts'],
      ['game-bell', 'sounds'],
    ]);
  });

  it('adds nothing for a game without credits', () => {
    expect(creditRowsOf([])).toStrictEqual([]);
  });
});
