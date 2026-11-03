// packages/shell/src/app/parity/parity-request.ts
// Test builds only (reached through test-only.ts). Parses the -parity launch argument that the
// toybox-visual-parity capture script passes, for example
//   frame=s4-home&theme=dark&lang=fa&game=lineSiege&date=2026-09-27&animations=off&scrollY=600
// and, once before the capture of a Game-route frame, the same query with probe=board: that launch
// opens no frame state and turns the board-layout probe on, so the capture script can read the
// board rectangle it masks. Every launch also carries nonce=<a fresh hex word>: the parity root
// shows it as the testID parity.launch.<nonce> (ParityLaunchMarker), so the capture script can
// prove a hierarchy dump came from this launch and not from another session's simulator. An
// unknown or malformed parameter is an error, never ignored: a capture of the wrong state would
// compare the wrong screen with the reference.
import { isLanguage } from '@e07/shell/i18n/languages.ts';
import { isDateKey } from '@e07/shell/screens/debug/debug-overrides.ts';

import { PARITY_PLANS, isParityFrameKey } from './parity-plans.ts';

import type { ParityFrameKey, ParityPlan } from './parity-plans.ts';
import type { Language } from '@e07/shell/i18n/languages.ts';

export type ParityTheme = 'light' | 'dark';

export type ParityRequest = {
  readonly frame: ParityFrameKey;
  /** The frame's plan (start route, player data, premium, state), so startup code that reaches
   * the harness only through TEST_ONLY never imports parity-plans.ts itself. */
  readonly plan: ParityPlan;
  readonly theme: ParityTheme;
  readonly lang: Language;
  /** Design game id (lineSiege, flockTilt, scrapShove): the fixture values follow it. */
  readonly game: string;
  /** The FakeClock date, YYYY-MM-DD. */
  readonly date: string;
  /** Scroll offset of tall frames, in points. */
  readonly scrollY: number;
  /** probe=board: the board probe launch (no frame state; the host renders game.board-layout). */
  readonly probe?: 'board';
  /** This launch's nonce: the parity root renders the marker parity.launch.<nonce>. */
  readonly nonce?: string;
};

export type ParityParseResult =
  | { readonly ok: true; readonly request: ParityRequest }
  | { readonly ok: false; readonly error: string };

type FieldCheck = {
  readonly key: string;
  readonly required: boolean;
  readonly isValid: (value: string) => boolean;
  readonly message: string;
};

function isTheme(value: string): value is ParityTheme {
  return value === 'light' || value === 'dark';
}

const FIELDS: readonly FieldCheck[] = [
  { key: 'frame', required: true, isValid: isParityFrameKey, message: 'is not a design frame key' },
  { key: 'theme', required: true, isValid: isTheme, message: 'must be light or dark' },
  { key: 'lang', required: true, isValid: isLanguage, message: 'must be en, de, fa or ckb' },
  {
    key: 'game',
    required: true,
    isValid: (value) => /^[a-z][A-Za-z0-9]*$/.test(value),
    message: 'must be a camelCase game id',
  },
  { key: 'date', required: true, isValid: isDateKey, message: 'must be a real YYYY-MM-DD' },
  {
    key: 'animations',
    required: true,
    isValid: (value) => value === 'off',
    message: 'must be off',
  },
  {
    key: 'scrollY',
    required: false,
    isValid: (value) => /^\d+$/.test(value),
    message: 'must be whole points >= 0',
  },
  {
    key: 'probe',
    required: false,
    isValid: (value) => value === 'board',
    message: 'must be board',
  },
  {
    key: 'nonce',
    required: false,
    isValid: (value) => /^[a-z0-9]{6,32}$/.test(value),
    message: 'must be 6 to 32 lower-case letters and digits',
  },
];

function decode(raw: string): string | null {
  try {
    return decodeURIComponent(raw.replace(/\+/g, ' '));
  } catch {
    return null;
  }
}

function splitQuery(query: string): Map<string, string> | string {
  const fields = new Map<string, string>();
  for (const part of query.split('&')) {
    const at = part.indexOf('=');
    const key = at === -1 ? part : part.slice(0, at);
    if (!FIELDS.some((field) => field.key === key)) return `unknown parameter "${key}"`;
    if (fields.has(key)) return `parameter "${key}" given twice`;
    const value = decode(at === -1 ? '' : part.slice(at + 1));
    if (value === null) return `parameter "${key}" has a broken %-escape`;
    fields.set(key, value);
  }
  return fields;
}

function firstError(fields: ReadonlyMap<string, string>): string | null {
  for (const field of FIELDS) {
    const value = fields.get(field.key);
    if (value === undefined) {
      if (field.required) return `missing ${field.key}`;
    } else if (!field.isValid(value)) {
      return `${field.key} "${value}" ${field.message}`;
    }
  }
  return null;
}

/** probe=board marks the board probe launch; a capture launch has no probe at all. */
function probeOf(fields: ReadonlyMap<string, string>): Pick<ParityRequest, 'probe'> {
  return fields.get('probe') === 'board' ? { probe: 'board' } : {};
}

/** The launch nonce, when the capture script sent one. */
function nonceOf(fields: ReadonlyMap<string, string>): Pick<ParityRequest, 'nonce'> {
  const nonce = fields.get('nonce');
  return nonce === undefined ? {} : { nonce };
}

function toRequest(fields: ReadonlyMap<string, string>): ParityRequest | null {
  const frame = fields.get('frame') ?? '';
  const theme = fields.get('theme') ?? '';
  const lang = fields.get('lang') ?? '';
  if (!isParityFrameKey(frame) || !isTheme(theme) || !isLanguage(lang)) return null;
  return {
    frame,
    plan: PARITY_PLANS[frame],
    theme,
    lang,
    game: fields.get('game') ?? '',
    date: fields.get('date') ?? '',
    scrollY: Number(fields.get('scrollY') ?? '0'),
    ...probeOf(fields),
    ...nonceOf(fields),
  };
}

/** Parses the -parity launch argument into a request, or says exactly what is wrong with it. */
export function parseParityRequest(query: string): ParityParseResult {
  const fields = splitQuery(query.trim());
  if (typeof fields === 'string') return { ok: false, error: fields };
  const error = firstError(fields);
  const request = error === null ? toRequest(fields) : null;
  if (request === null) return { ok: false, error: error ?? 'invalid request' };
  return { ok: true, request };
}
