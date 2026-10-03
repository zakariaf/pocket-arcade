// packages/shell/src/i18n/messages.ts
import ckb from './catalogs/ckb.json';
import de from './catalogs/de.json';
import en from './catalogs/en.json';
import fa from './catalogs/fa.json';

import type { Language } from './languages.ts';

export type Catalog = Readonly<Record<string, string>>;
export type ShellMessageKey = keyof typeof en;
// Game keys start with the game id ("line-siege.lose.broke-through"). The Shell cannot know them
// statically: a game hands them over as plain message ids, and the Shell brands them in one place,
// gameMessageText (game-message-text.ts). A typo in a Shell key stays a type error, and t() never
// accepts a plain string.
export type GameMessageKey = string & { readonly brand: 'GameMessageKey' };
export type MessageKey = ShellMessageKey | GameMessageKey;

// Called only by game-message-text.ts (check-i18n-code rule game-key-cast).
export function asGameKey(key: string): GameMessageKey {
  return key as GameMessageKey;
}

const SHELL_CATALOGS: Readonly<Record<Language, Catalog>> = { en, de, fa, ckb };

export function messagesFor(
  language: Language,
  gameCatalogs: Readonly<Record<Language, Catalog>>,
): Catalog {
  return { ...SHELL_CATALOGS[language], ...gameCatalogs[language] };
}
