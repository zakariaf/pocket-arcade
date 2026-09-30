// catalog-rules.mjs: the Pocket Arcade catalog rules L1-L12 plus the cross-language parity rules
// (what `formatjs verify --missing-keys --extra-keys --structural-equality` checks, and more).
// Not an entry point: check-catalogs.mjs and copy-deck.mjs import it.
//
// The rule ids and messages match the project's own linter (packages/tooling/src/i18n/
// catalog-lint-rules.ts in templates/tooling-i18n/), so both tools print the same words.

import { collectVariables, exactSelectors, IcuSyntaxError, parseIcu, walkIcu } from './icu-parse.mjs';

export const LANGUAGES = ['en', 'de', 'fa', 'ckb'];
export const SOURCE_LANGUAGE = 'en';

const KEY_FORMAT = /^[a-z0-9]+(-[a-z0-9]+)*(\.[a-z0-9]+(-[a-z0-9]+)*){1,4}$/;
const ARG_NAME = /^[a-z][A-Za-z0-9]*$/;
const TEXT_ARG = /(Name|Text)$/;
const PLURAL_OPTION = /^(one|other|=\d+)$/;
const ANY_DIGIT = /[0-9\u0660-\u0669\u06F0-\u06F9]/;
const BANNED_CONTROLS = /[\u061C\u202A-\u202E\u2066-\u2069]/;
const ARABIC_ONLY_LETTERS = /[\u064A\u0643]/; // Arabic yeh and kaf
const LATIN_PUNCTUATION = /[,;?]/;
const JOINER_EDGE = /^[\s,;:+&/\u2013-]|[\s,;:+&/\u2013-]$/;
const DEBUG_PREFIX = 'debug.';

/** Rule id -> [short name, fix]. */
export const RULES = {
  L1: ['key-shape', 'Rename the key to <area>.<element>[.<variant>]: 2-5 lowercase kebab-case segments (home.play-button.continue).'],
  L1b: ['key-namespace', 'Game keys start with "<game-id>."; Shell keys never start with a game id. Move the key to the right catalog or rename it.'],
  L2: ['icu-syntax', 'Fix the ICU syntax: balanced braces, {x, number}, {x, plural, one {...} other {...}}; quote literal braces as \'{\'.'],
  L3: ['no-date-time-tags', 'Remove {x, date}/{x, time} and <tags>: format dates with formatDayMonth() and keep emphasis out of messages.'],
  L4: ['placeholder-name', 'Name placeholders in camelCase; a plain {x} must end in Name/Text (free text), numbers use {x, number} or a plural.'],
  L5: ['plural-categories', 'Use only one, other and =N in plurals (no few/many/two/zero, no offset, no selectordinal), and always both one and other.'],
  L6: ['count-needs-plural', 'A number followed by a counted noun must be {n, plural, one {# noun} other {# nouns}}.'],
  L7: ['literal-digits', 'Replace digits in the text with a {x, number} placeholder so the digits follow the language.'],
  L8: ['bidi-controls', 'Delete the bidi control characters; t() isolates *Name/*Text values with FSI/PDI itself.'],
  L9: ['arabic-letters', 'Replace Arabic ي (U+064A) and ك (U+0643) with Persian ی (U+06CC) and ک (U+06A9).'],
  L10: ['latin-punctuation', 'Use Persian punctuation in fa/ckb: ، (comma) ؛ (semicolon) ؟ (question mark).'],
  L11: ['sentence-shape', 'Store one whole sentence per key: no leading/trailing space or joiner, no double space, English starts with a capital, not a bare placeholder.'],
  L12: ['keys-sorted', 'Sort the keys alphabetically (JavaScript default sort): run copy-deck.mjs apply or rewrite the file with sorted keys.'],
  P1: ['missing-key', 'Add the key to this language with a real translation (never an English placeholder).'],
  P2: ['extra-key', 'Delete the key, or add it to en.json first: English is the source catalog.'],
  P3: ['placeholder-parity', 'Use exactly the same placeholders with the same types as en.json (same names; number stays number, plural stays plural).'],
  P4: ['exact-plural-parity', 'Give every language the same =N branches as en.json (fa counts 0 as "one", so =0 must exist everywhere or nowhere).'],
  F1: ['catalog-file', 'Every catalog folder needs en.json, de.json, fa.json and ckb.json: flat JSON objects of key -> ICU string.'],
  G1: ['required-game-key', 'Add <game-id>.name, <game-id>.win-title and <game-id>.tagline to all four catalogs (copy-deck.mjs apply --game <game-id>): the Shell reads them through GameIdentity.nameId, winTitleId and taglineId.'],
};

/** The keys the Shell reads from every game catalog through the identity (nameId, winTitleId, taglineId). */
export function requiredGameKeys(gameId) {
  return [`${gameId}.name`, `${gameId}.win-title`, `${gameId}.tagline`];
}

export function ruleLabel(id) {
  return `${id} ${RULES[id][0]}`;
}

/** Problems for one message: [{ id, message }]. */
export function lintMessage({ language, key, message, namespace }) {
  const problems = [];
  const add = (id, text) => problems.push({ id, message: text });
  if (!KEY_FORMAT.test(key)) add('L1', 'key must be 2-5 dot-separated kebab-case segments');
  if (namespace?.kind === 'game' && !key.startsWith(`${namespace.gameId}.`)) add('L1b', `game keys start with "${namespace.gameId}."`);
  if (namespace?.kind === 'shell') {
    const owner = (namespace.gameIds ?? []).find((id) => key.startsWith(`${id}.`));
    if (owner) add('L1b', `"${owner}." is reserved for that game's catalog`);
  }
  if (typeof message !== 'string') {
    add('F1', 'value is not a string');
    return problems;
  }
  if (message.trim() === '') add('L11', 'empty message');
  if (JOINER_EDGE.test(message)) add('L11', 'starts/ends with space or joiner: fragment of a glued sentence?');
  if (/ {2}/.test(message)) add('L11', 'double space');
  if (language === 'en' && /^\p{Ll}/u.test(message)) add('L11', 'English message starts lowercase: fragment?');
  let elements;
  try {
    elements = parseIcu(message, { requiresOtherClause: true });
  } catch (error) {
    if (error instanceof IcuSyntaxError) {
      add('L2', `ICU syntax error: ${error.message}`);
      return problems;
    }
    throw error;
  }
  // The S15 debug menu is English in every language on purpose (test builds only), so the
  // Arabic-script letter and punctuation rules do not apply to debug.* keys.
  const isArabicScript = (language === 'fa' || language === 'ckb') && !key.startsWith(DEBUG_PREFIX);
  walkIcu(elements, (el, next) => {
    if (el.type === 'date' || el.type === 'time') add('L3', 'no {x, date}/{x, time}: use formatDayMonth');
    if (el.type === 'tag') add('L3', 'no rich-text tags in messages');
    if (el.type !== 'literal' && el.type !== 'pound') {
      const name = el.value;
      if (!ARG_NAME.test(name)) add('L4', `placeholder "${name}" must be camelCase`);
      else if (el.type === 'argument' && !TEXT_ARG.test(name)) add('L4', `{${name}} is plain text: name it *Name/*Text, or use {${name}, number} / plural`);
      else if (el.type !== 'argument' && el.type !== 'tag' && TEXT_ARG.test(name)) add('L4', `"${name}" ends in Name/Text, which is reserved for plain-text placeholders`);
    }
    if (el.type === 'plural') {
      if (el.pluralType === 'ordinal') add('L5', 'selectordinal is not used in this project');
      else if (el.offset !== 0) add('L5', 'plural offset is not allowed');
      else {
        const options = Object.keys(el.options);
        for (const option of options.filter((o) => !PLURAL_OPTION.test(o))) add('L5', `plural category "${option}" does not exist in en/de/fa/ckb`);
        if (!options.includes('one')) add('L5', 'every plural needs "one" and "other" in all four languages');
      }
    }
    if (language === 'en' && el.type === 'number' && next && next.type === 'literal' && /^\s+\p{L}/u.test(next.value)) {
      add('L6', `{${el.value}, number} is followed by a word: use {${el.value}, plural, one {…} other {…}}`);
    }
    if (el.type === 'literal') {
      if (ANY_DIGIT.test(el.value)) add('L7', 'literal digits: numbers must be placeholders');
      if (BANNED_CONTROLS.test(el.value)) add('L8', 'bidi controls/ALM in catalog: t() isolates values');
      if (isArabicScript && ARABIC_ONLY_LETTERS.test(el.value)) add('L9', 'Arabic ي/ك: use Persian ی/ک');
      if (isArabicScript && LATIN_PUNCTUATION.test(el.value)) add('L10', 'Latin , ; ? in fa/ckb: use ، ؛ ؟');
    }
  });
  if (elements.length === 1 && !['literal', 'plural', 'select'].includes(elements[0].type)) {
    add('L11', 'message is a bare placeholder: put the whole sentence in the catalog');
  }
  return problems;
}

/** Parsed elements or null (syntax errors are reported by lintMessage). */
export function tryParse(message) {
  try {
    return parseIcu(message, { requiresOtherClause: true });
  } catch {
    return null;
  }
}

function describeVars(vars) {
  return [...vars].map(([name, kinds]) => `${name}:${[...kinds].join('|')}`).sort().join(', ') || '(none)';
}

/** Parity of one key between the source message and a translation: [{ id, message }]. */
export function parityProblems(sourceMessage, message) {
  const source = tryParse(sourceMessage);
  const target = tryParse(message);
  if (!source || !target) return [];
  const problems = [];
  const a = collectVariables(source);
  const b = collectVariables(target);
  const same = a.size === b.size && [...a].every(([name, kinds]) => b.has(name) && [...kinds].sort().join() === [...b.get(name)].sort().join());
  if (!same) problems.push({ id: 'P3', message: `placeholders differ from en: en has ${describeVars(a)}; this has ${describeVars(b)}` });
  const ea = exactSelectors(source);
  const eb = exactSelectors(target);
  for (const name of new Set([...ea.keys(), ...eb.keys()])) {
    const left = [...(ea.get(name) ?? [])].sort().join(' ');
    const right = [...(eb.get(name) ?? [])].sort().join(' ');
    if (left !== right) problems.push({ id: 'P4', message: `plural {${name}} has exact branches [${right || 'none'}] but en has [${left || 'none'}]` });
  }
  return problems;
}

/** 1-based line of a key in a JSON file's text (first occurrence), or 1. */
export function lineOfKey(text, key) {
  const needle = `${JSON.stringify(key)}:`;
  const index = text.indexOf(needle);
  if (index === -1) {
    const loose = text.indexOf(JSON.stringify(key));
    return loose === -1 ? 1 : text.slice(0, loose).split('\n').length;
  }
  return text.slice(0, index).split('\n').length;
}
