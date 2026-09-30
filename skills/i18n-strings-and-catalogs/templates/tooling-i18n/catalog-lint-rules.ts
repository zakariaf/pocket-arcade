// packages/tooling/src/i18n/catalog-lint-rules.ts
import {
  isArgumentElement,
  isDateElement,
  isLiteralElement,
  isNumberElement,
  isPluralElement,
  isSelectElement,
  isTagElement,
  isTimeElement,
  parse,
} from '@formatjs/icu-messageformat-parser';

import { walk } from './icu-walk.ts';

import type { MessageFormatElement } from '@formatjs/icu-messageformat-parser';

export type Language = 'en' | 'de' | 'fa' | 'ckb';
// Shell keys must not start with a game id; game keys must start with their own.
export type Namespace =
  | { readonly kind: 'shell'; readonly gameIds: readonly string[] }
  | { readonly kind: 'game'; readonly gameId: string };
export type MessageContext = {
  readonly language: Language;
  readonly key: string;
  readonly message: string;
  readonly namespace: Namespace;
};

const KEY_FORMAT = /^[a-z0-9]+(-[a-z0-9]+)*(\.[a-z0-9]+(-[a-z0-9]+)*){1,4}$/;
const ARG_NAME = /^[a-z][A-Za-z0-9]*$/;
const TEXT_ARG = /(Name|Text)$/;
const PLURAL_OPTION = /^(one|other|=\d+)$/;
const ANY_DIGIT = /[0-9\u0660-\u0669\u06F0-\u06F9]/;
const BANNED_CONTROLS = /[\u061C\u202A-\u202E\u2066-\u2069]/;
const ARABIC_ONLY_LETTERS = /[\u064A\u0643]/; // Arabic yeh and kaf: use ی (U+06CC) and ک (U+06A9)
const LATIN_PUNCTUATION = /[,;?]/; // fa/ckb use ، ؛ ؟
const JOINER_EDGE = /^[\s,;:+&/\u2013-]|[\s,;:+&/\u2013-]$/;
// The S15 debug menu is English in every language on purpose (test builds only).
const DEBUG_PREFIX = 'debug.';

function namespaceProblem(key: string, namespace: Namespace): string | null {
  if (namespace.kind === 'game') {
    return key.startsWith(`${namespace.gameId}.`)
      ? null
      : `game keys start with "${namespace.gameId}."`;
  }
  const owner = namespace.gameIds.find((id) => key.startsWith(`${id}.`));
  return owner === undefined ? null : `"${owner}." is reserved for that game's catalog`;
}

export function checkKey({ key, namespace }: MessageContext): string[] {
  const problems: string[] = [];
  if (!KEY_FORMAT.test(key)) problems.push('key must be 2-5 dot-separated kebab-case segments');
  const problem = namespaceProblem(key, namespace);
  if (problem !== null) problems.push(problem);
  return problems;
}

export function parseMessage(message: string): MessageFormatElement[] | string {
  try {
    return parse(message, { requiresOtherClause: true, shouldParseSkeletons: true });
  } catch (error) {
    return `ICU syntax error: ${String(error)}`;
  }
}

function checkBannedElement(el: MessageFormatElement): string[] {
  if (isDateElement(el) || isTimeElement(el)) return ['no {x, date}/{x, time}: use formatDayMonth'];
  if (isTagElement(el)) return ['no rich-text tags in messages'];
  return [];
}

function checkPlaceholderName(el: MessageFormatElement): string[] {
  if (isLiteralElement(el) || !('value' in el) || typeof el.value !== 'string') return [];
  const name = el.value;
  if (!ARG_NAME.test(name)) return [`placeholder "${name}" must be camelCase`];
  const isPlainText = isArgumentElement(el);
  if (isPlainText && !TEXT_ARG.test(name)) {
    return [`{${name}} is plain text: name it *Name/*Text, or use {${name}, number} / plural`];
  }
  if (!isPlainText && TEXT_ARG.test(name)) {
    return [`"${name}" ends in Name/Text, which is reserved for plain-text placeholders`];
  }
  return [];
}

function checkPlural(el: MessageFormatElement): string[] {
  if (!isPluralElement(el)) return [];
  if (el.pluralType === 'ordinal') return ['selectordinal is not used in this project'];
  if (el.offset !== 0) return ['plural offset is not allowed'];
  const options = Object.keys(el.options);
  const bad = options.filter((option) => !PLURAL_OPTION.test(option));
  const problems = bad.map(
    (option) => `plural category "${option}" does not exist in en/de/fa/ckb`,
  );
  if (!options.includes('one'))
    problems.push('every plural needs "one" and "other" in all four languages');
  return problems;
}

function checkCountNeedsPlural(
  el: MessageFormatElement,
  next: MessageFormatElement | undefined,
): string[] {
  if (!isNumberElement(el) || next === undefined || !isLiteralElement(next)) return [];
  return /^\s+\p{L}/u.test(next.value)
    ? [`{${el.value}, number} is followed by a word: use {${el.value}, plural, one {…} other {…}}`]
    : [];
}

function checkLiteral(el: MessageFormatElement, ctx: MessageContext): string[] {
  if (!isLiteralElement(el)) return [];
  const problems: string[] = [];
  if (ANY_DIGIT.test(el.value)) problems.push('literal digits: numbers must be placeholders');
  if (BANNED_CONTROLS.test(el.value))
    problems.push('bidi controls/ALM in catalog: t() isolates values');
  const isArabicScript =
    (ctx.language === 'fa' || ctx.language === 'ckb') && !ctx.key.startsWith(DEBUG_PREFIX);
  if (isArabicScript && ARABIC_ONLY_LETTERS.test(el.value))
    problems.push('Arabic ي/ك: use Persian ی/ک');
  if (isArabicScript && LATIN_PUNCTUATION.test(el.value))
    problems.push('Latin , ; ? in fa/ckb: use ، ؛ ؟');
  return problems;
}

export function checkSentence({ language, message }: MessageContext): string[] {
  const problems: string[] = [];
  if (message.trim() === '') problems.push('empty message');
  if (JOINER_EDGE.test(message))
    problems.push('starts/ends with space or joiner: fragment of a glued sentence?');
  if (/ {2}/.test(message)) problems.push('double space');
  if (language === 'en' && /^\p{Ll}/u.test(message))
    problems.push('English message starts lowercase: fragment?');
  return problems;
}

export function checkElements(
  elements: readonly MessageFormatElement[],
  ctx: MessageContext,
): string[] {
  const problems: string[] = [];
  walk(elements, (el, next) => {
    problems.push(...checkBannedElement(el), ...checkPlaceholderName(el), ...checkPlural(el));
    problems.push(...checkLiteral(el, ctx));
    if (ctx.language === 'en') problems.push(...checkCountNeedsPlural(el, next));
  });
  if (
    elements.length === 1 &&
    elements[0] !== undefined &&
    !isLiteralElement(elements[0]) &&
    !isPluralElement(elements[0]) &&
    !isSelectElement(elements[0])
  ) {
    problems.push('message is a bare placeholder: put the whole sentence in the catalog');
  }
  return problems;
}

/**
 * The keys the Shell reads from every game catalog through the game module's identity: the name
 * (S1, S4, S10, S11b; GameIdentity.nameId), the S7 win title (winTitleId) and the tagline under
 * the name on S1, S4 and S11b (taglineId).
 */
export function requiredGameKeys(gameId: string): readonly string[] {
  return [`${gameId}.name`, `${gameId}.win-title`, `${gameId}.tagline`];
}

/** A game catalog without a key the Shell reads fails here, before a screen shows the raw id. */
export function missingGameKeys(namespace: Namespace, keys: readonly string[]): string[] {
  if (namespace.kind !== 'game') return [];
  const present = new Set(keys);
  return requiredGameKeys(namespace.gameId)
    .filter((key) => !present.has(key))
    .map((key) => `missing required game key "${key}" (the Shell reads it through the identity)`);
}

export function lintMessage(ctx: MessageContext): string[] {
  const parsed = parseMessage(ctx.message);
  const base = [...checkKey(ctx), ...checkSentence(ctx)];
  return typeof parsed === 'string' ? [...base, parsed] : [...base, ...checkElements(parsed, ctx)];
}
