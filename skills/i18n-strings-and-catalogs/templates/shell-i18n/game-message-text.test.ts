// packages/shell/src/i18n/game-message-text.test.ts
import { createIntl } from 'react-intl';

import { createT } from './create-t.ts';
import { localeTagFor } from './digits.ts';
import { gameMessageText } from './game-message-text.ts';
import { messagesFor } from './messages.ts';

import type { TFunction } from './create-t.ts';
import type { Language } from './languages.ts';
import type { Catalog } from './messages.ts';

// A game catalog as a game module ships it (keys start with the game id).
const DEMO: Readonly<Record<Language, Catalog>> = {
  en: { 'demo-game.hud.left': '{piecesCount, plural, one {# piece left} other {# pieces left}}' },
  de: { 'demo-game.hud.left': '{piecesCount, plural, one {Noch # Teil} other {Noch # Teile}}' },
  fa: { 'demo-game.hud.left': '{piecesCount, plural, one {# مهره مانده} other {# مهره مانده}}' },
  ckb: { 'demo-game.hud.left': '{piecesCount, plural, one {# پارچە ماوە} other {# پارچە ماوە}}' },
};

function failOnError(error: Error): never {
  throw error;
}

function tFor(language: Language): TFunction {
  const intl = createIntl({
    locale: localeTagFor(language, 'automatic'),
    messages: messagesFor(language, DEMO),
    defaultLocale: 'en',
    onError: failOnError,
  });
  return createT({ intl, onError: failOnError });
}

describe('gameMessageText', () => {
  it.each([
    ['en', 1, '1 piece left'],
    ['de', 3, 'Noch 3 Teile'],
    ['fa', 3, '۳ مهره مانده'],
  ] as const)('formats a game message in %s (%i)', (language, piecesCount, expected) => {
    const message = { id: 'demo-game.hud.left', values: { piecesCount } };
    expect(gameMessageText(tFor(language), message)).toBe(expected);
  });

  it('formats a bare message id without values', () => {
    expect(gameMessageText(tFor('en'), { id: 'common.levels' })).toBe('Levels');
  });
});
