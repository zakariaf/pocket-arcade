// packages/game-kit/src/contract/messages.ts
/** The four shipped languages (spec N6). */
export type LanguageCode = 'en' | 'de' | 'fa' | 'ckb';

/** A semantic catalog key; game keys start with the game id ('line-siege.lose.broke-through'). */
export type MessageId = string;

/** A message id plus its ICU placeholder values; the Shell formats it with t(). */
export type Message = {
  readonly id: MessageId;
  readonly values: Readonly<Record<string, number | string>>;
};

/** One flat ICU catalog: semantic key -> ICU MessageFormat string. */
export type Catalog = Readonly<Record<MessageId, string>>;

/** Spec 10 TEXTS: all four catalogs; a missing key fails `npm run i18n:verify`. */
export type GameTexts = Readonly<Record<LanguageCode, Catalog>>;
