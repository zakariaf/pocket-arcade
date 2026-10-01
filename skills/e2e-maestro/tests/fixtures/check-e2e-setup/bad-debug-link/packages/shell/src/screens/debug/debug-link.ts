// packages/shell/src/screens/debug/debug-link.ts
// Pure: reads a test build's debug link <scheme>://debug/setup?<param>=<value>&... into a typed
// request. The parameters and values are exactly e2e-maestro's debug-link table (and its
// debug-link-params.json): an unknown parameter, value or a repeated parameter is an error, never
// ignored, so a typo fails fast instead of silently testing the wrong state.
import { isLanguage } from '@e07/shell/i18n/languages.ts';

import { isDateKey } from './debug-overrides.ts';

import type { DebugConsentGeography } from './debug-overrides.ts';
import type { DateKey } from '@e07/game-kit/dates/date-key.ts';
import type { DigitStyle } from '@e07/shell/i18n/digits.ts';
import type { Language } from '@e07/shell/i18n/languages.ts';

export const DEBUG_SCREENS = [
  'home',
  'levels',
  'daily',
  'stats',
  'settings',
  'premium',
  'how-to-play',
  'debug',
  'game',
  'game-start',
  'game-middle',
  'result-win',
  'result-lose',
] as const;
export type DebugScreen = (typeof DEBUG_SCREENS)[number];

/** stars=<level>:<stars>,...: 1-3 records a win with that many stars, 0 clears the level. */
export type LevelStars = { readonly level: number; readonly stars: 0 | 1 | 2 | 3 };

export type DebugLinkRequest = {
  readonly lang?: Language;
  readonly digits?: DigitStyle;
  readonly theme?: 'system' | 'light' | 'dark';
  readonly seed?: number;
  readonly level?: number;
  readonly date?: DateKey;
  readonly ads?: 'off' | 'test';
  readonly premium?: boolean;
  readonly offline?: boolean;
  readonly firstRun?: boolean;
  readonly reduceMotion?: boolean;
  readonly stars?: 'demo' | readonly LevelStars[];
  readonly screen?: DebugScreen;
  readonly action?: 'win-level' | 'lose-level';
  readonly boardLayout?: boolean;
  /** Test builds with ads on (the ads smoke test): the consent geography Google's UMP is asked with. */
  readonly geo?: DebugConsentGeography;
};

export type DebugLinkParse =
  | { readonly kind: 'not-debug' }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'request'; readonly request: DebugLinkRequest };

type Reader = (value: string) => DebugLinkRequest | null;

const MAX_UINT32 = 4_294_967_295;
const DIGITS: Readonly<Record<string, DigitStyle>> = {
  auto: 'automatic',
  latin: 'latin',
  local: 'local',
};

const oneOf =
  <T extends string>(values: readonly T[], make: (value: T) => DebugLinkRequest): Reader =>
  (value) =>
    (values as readonly string[]).includes(value) ? make(value as T) : null;
const flag =
  (make: (isOn: boolean) => DebugLinkRequest): Reader =>
  (value) =>
    value === '0' || value === '1' ? make(value === '1') : null;
const integer = (value: string, min: number, max: number): number | null => {
  const number = /^\d{1,10}$/.test(value) ? Number(value) : Number.NaN;
  return number >= min && number <= max ? number : null;
};

function readStars(value: string): DebugLinkRequest | null {
  if (value === 'demo') return { stars: 'demo' };
  const entries = value.split(',').map((pair) => /^(\d{1,4}):([0-3])$/.exec(pair));
  if (entries.some((match) => match === null)) return null;
  const stars = entries.map((match) => ({
    level: Number(match?.[1]),
    stars: Number(match?.[2]) as LevelStars['stars'],
  }));
  return stars.every((entry) => entry.level >= 1) ? { stars } : null;
}

const READERS: Readonly<Record<string, Reader>> = {
  lang: (value) => (isLanguage(value) ? { lang: value } : null),
  digits: (value) => (DIGITS[value] === undefined ? null : { digits: DIGITS[value] }),
  theme: oneOf(['system', 'light', 'dark'], (theme) => ({ theme })),
  seed: (value) => {
    const seed = integer(value, 0, MAX_UINT32);
    return seed === null ? null : { seed };
  },
  level: (value) => {
    const level = integer(value, 1, 9999);
    return level === null ? null : { level };
  },
  date: (value) => (isDateKey(value) ? { date: value } : null),
  ads: oneOf(['off', 'test'], (ads) => ({ ads })),
  premium: flag((isOn) => ({ premium: isOn })),
  offline: flag((isOn) => ({ offline: isOn })),
  firstRun: flag((isOn) => ({ firstRun: isOn })),
  reduceMotion: flag((isOn) => ({ reduceMotion: isOn })),
  stars: readStars,
  screen: oneOf(DEBUG_SCREENS, (screen) => ({ screen })),
  action: oneOf(['win-level', 'lose-level'], (action) => ({ action })),
  geo: oneOf(['eea', 'other'], (geo) => ({ geo })),
};

const LINK = /^[a-z][a-z0-9+.-]*:\/\/debug\/setup\/?(?:\?(.*))?$/i;

function decode(part: string): string | null {
  try {
    return decodeURIComponent(part.replaceAll('+', ' '));
  } catch {
    return null;
  }
}

/** Reads every name=value pair in order; the first bad one is the error. */
function readQuery(query: string): DebugLinkParse {
  let request: DebugLinkRequest = {};
  const seen = new Set<string>();
  for (const pair of query.split('&').filter((part) => part !== '')) {
    const [rawName = '', ...rest] = pair.split('=');
    const name = decode(rawName);
    const value = decode(rest.join('='));
    if (name === null || value === null) {
      return { kind: 'error', message: `"${pair}" has a broken %-escape` };
    }
    const reader = READERS[name];
    if (reader === undefined)
      return { kind: 'error', message: `unknown debug parameter "${name}"` };
    if (seen.has(name)) return { kind: 'error', message: `debug parameter "${name}" is repeated` };
    const patch = reader(value);
    if (patch === null)
      return { kind: 'error', message: `debug parameter ${name}="${value}" is not allowed` };
    seen.add(name);
    request = { ...request, ...patch };
  }
  return { kind: 'request', request };
}

/** A link that is not <scheme>://debug/setup is none of the debug module's business. */
export function parseDebugLink(url: string): DebugLinkParse {
  const match = LINK.exec(url.trim());
  if (match === null) return { kind: 'not-debug' };
  return readQuery(match[1] ?? '');
}
