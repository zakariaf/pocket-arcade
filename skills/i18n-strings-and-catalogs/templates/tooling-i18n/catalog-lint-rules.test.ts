// packages/tooling/src/i18n/catalog-lint-rules.test.ts
import { debugEnglishProblems, lintMessage, missingGameKeys } from './catalog-lint-rules.ts';

import type { Language, Namespace } from './catalog-lint-rules.ts';

const SHELL: Namespace = { kind: 'shell', gameIds: ['line-siege'] };

function lint(message: string, language: Language = 'en', key = 'home.title'): string[] {
  return lintMessage({ language, key, message, namespace: SHELL });
}

describe('lintMessage', () => {
  it('accepts a whole sentence with a typed number and a counted noun', () => {
    expect(
      lint('{movesCount, plural, one {# move} other {# moves}} – par {par, number}'),
    ).toStrictEqual([]);
  });

  it.each([
    ['{level} left', '{level} is plain text'],
    ['{movesCount, plural, few {a} other {b}}', 'plural category "few"'],
    ['{moves, number} moves', 'is followed by a word'],
    ['Level 12', 'literal digits'],
    ['{day, date}', 'no {x, date}'],
    [' Play', 'starts/ends with space or joiner'],
    ['{dateText}', 'bare placeholder'],
  ])('rejects %j', (message, expected) => {
    expect(lint(message).join('\n')).toContain(expected);
  });

  it('rejects Latin punctuation and Arabic letters in Persian, except the English debug menu', () => {
    expect(lint('سلام, دنیا', 'fa').join('\n')).toContain('Latin , ; ?');
    expect(lint('كتاب', 'fa').join('\n')).toContain('Arabic');
    expect(lint('Force language, direction and digits', 'fa', 'debug.force-locale')).toStrictEqual(
      [],
    );
  });

  it('keeps game ids out of Shell keys and bad key shapes out of every catalog', () => {
    expect(lint('Hello', 'en', 'line-siege.name').join('\n')).toContain('reserved');
    expect(lint('Hello', 'en', 'Home.Title').join('\n')).toContain('2-5 dot-separated');
  });
});

describe('debugEnglishProblems', () => {
  const EN = { 'debug.title': 'Debug menu', 'home.title': 'Home' };

  it('accepts the English debug menu in every language and leaves other keys alone', () => {
    const fa = { 'debug.title': 'Debug menu', 'home.title': 'خانه' };
    expect(debugEnglishProblems(EN, fa, 'fa')).toStrictEqual([]);
    expect(debugEnglishProblems(EN, EN, 'en')).toStrictEqual([]);
  });

  it('rejects a translated debug text (L13: S15 stays English)', () => {
    const de = { 'debug.title': 'Debug-Menü', 'home.title': 'Start' };
    expect(debugEnglishProblems(EN, de, 'de')).toStrictEqual([
      'debug.title: debug-english: the debug menu (S15) stays English in every language; write the en text',
    ]);
  });
});

describe('missingGameKeys', () => {
  const GAME: Namespace = { kind: 'game', gameId: 'line-siege' };

  it('requires the name, the win title and the tagline the Shell reads through the identity', () => {
    expect(missingGameKeys(GAME, ['line-siege.name', 'line-siege.tagline'])).toStrictEqual([
      'missing required game key "line-siege.win-title" (the Shell reads it through the identity)',
    ]);
    expect(
      missingGameKeys(GAME, ['line-siege.name', 'line-siege.win-title', 'line-siege.tagline']),
    ).toStrictEqual([]);
  });

  it('asks nothing of the Shell catalog', () => {
    expect(missingGameKeys(SHELL, [])).toStrictEqual([]);
  });
});
