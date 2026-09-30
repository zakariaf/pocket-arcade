// packages/shell/src/screens/debug/debug-tools.ts
// Pure: what S15's tools compute (debug-actions.ts runs them): the requests "Unlock all" and
// "Give stars" send through the debug link handler, the level and date choices, the texts "Show
// state" and "Error log" show, and the "Force language" choices. English on purpose, like every
// S15 text (the design keeps the debug menu untranslated).
import { addDays, fromDayNumber } from '@e07/game-kit/dates/date-key.ts';
import { isolate } from '@e07/shell/i18n/bidi.ts';

import type { DebugLinkRequest, LevelStars } from './debug-link.ts';
import type { DateKey } from '@e07/game-kit/dates/date-key.ts';
import type { Direction, Language } from '@e07/shell/i18n/languages.ts';
import type { ErrorLogEntry } from '@e07/shell/services/error-log/error-log-port.ts';
import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';

type Levels = SaveDoc['progress']['levels'];

/** How many error-log entries "Error log" shows (newest first). */
export const ERROR_LOG_LINES = 10;
/** The day every screenshot and flow uses (date=2026-09-26). */
export const SCREENSHOT_DAY: DateKey = '2026-09-26';

export type Choice<T> = { readonly label: string; readonly value: T };

/** "Unlock all levels": every level without a result is won with 1 star; results are kept. */
export function unlockAllRequest(levels: Levels, levelCount: number): DebugLinkRequest | null {
  const stars: LevelStars[] = Array.from({ length: levelCount }, (_, index) => index + 1)
    .filter((level) => levels[String(level)] === undefined)
    .map((level) => ({ level, stars: 1 }));
  return stars.length === 0 ? null : { stars };
}

/** "Give stars": every won level gets all three stars. */
export function giveStarsRequest(levels: Levels): DebugLinkRequest | null {
  const stars: LevelStars[] = Object.keys(levels)
    .map(Number)
    .sort((a, b) => a - b)
    .map((level) => ({ level, stars: 3 }));
  return stars.length === 0 ? null : { stars };
}

/** "Jump to level", first sheet: one choice per pack ("Levels 31-60"). */
export function packChoices(packCount: number, levelsPerPack: number): readonly Choice<number>[] {
  return Array.from({ length: packCount }, (_, pack) => ({
    label: `Levels ${String(pack * levelsPerPack + 1)}-${String((pack + 1) * levelsPerPack)}`,
    value: pack,
  }));
}

/** "Jump to level", second sheet: every level of the chosen pack. */
export function levelChoices(pack: number, levelsPerPack: number): readonly Choice<number>[] {
  return Array.from({ length: levelsPerPack }, (_, index) => {
    const level = pack * levelsPerPack + index + 1;
    return { label: `Level ${String(level)}`, value: level };
  });
}

/** "Set date": around the day today() answers now; null follows the real calendar again. */
export function dateChoices(today: DateKey): readonly Choice<DateKey | null>[] {
  return [
    { label: 'Real calendar', value: null },
    { label: `Yesterday (${addDays(today, -1)})`, value: addDays(today, -1) },
    { label: `Tomorrow (${addDays(today, 1)})`, value: addDays(today, 1) },
    { label: `In 7 days (${addDays(today, 7)})`, value: addDays(today, 7) },
    { label: `${SCREENSHOT_DAY} (screenshots and flows)`, value: SCREENSHOT_DAY },
  ];
}

/** "Force language, direction and digits": a language flip reloads back to S15. */
export const LOCALE_CHOICES: readonly Choice<DebugLinkRequest>[] = [
  { label: 'English', value: { lang: 'en', screen: 'debug' } },
  { label: 'Deutsch', value: { lang: 'de', screen: 'debug' } },
  { label: 'فارسی (RTL)', value: { lang: 'fa', screen: 'debug' } },
  { label: 'کوردی (RTL)', value: { lang: 'ckb', screen: 'debug' } },
  { label: 'Digits: automatic', value: { digits: 'automatic' } },
  { label: 'Digits: Latin', value: { digits: 'latin' } },
  { label: 'Digits: local', value: { digits: 'local' } },
];

/** "Show level seed and game state": the seed override and the saved run, as JSON. */
export function stateText(seedOverride: number | null, run: SaveDoc['run']): string {
  return JSON.stringify({ seedOverride, run }, null, 1);
}

const DAY_MS = 86_400_000;
const pad = (value: number): string => String(value).padStart(2, '0');

/** "2026-09-26 12:00:05 UTC" for an error-log time (the log keeps epoch milliseconds). */
export function utcStamp(atMs: number): string {
  const seconds = Math.floor((((atMs % DAY_MS) + DAY_MS) % DAY_MS) / 1000);
  const time = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60];
  return `${fromDayNumber(Math.floor(atMs / DAY_MS))} ${time.map(pad).join(':')} UTC`;
}

/** "Error log": the newest entries, one per line; the log never leaves the device (N2). */
export function errorLogText(entries: readonly ErrorLogEntry[]): string {
  if (entries.length === 0) return 'No errors recorded.';
  return entries
    .slice(0, ERROR_LOG_LINES)
    .map((entry) => `${utcStamp(entry.atMs)} ${entry.source}: ${entry.message}`)
    .join('\n');
}

/** The JS network guard records each blocked attempt with source 'network'. */
export function networkAttemptsOf(entries: readonly ErrorLogEntry[]): number {
  return entries.filter((entry) => entry.source === 'network').length;
}

/**
 * The "Force language" row's value: language, direction and a digit sample, isolated so an RTL
 * row keeps its order (it starts with the Latin language code, so the isolate runs left to right).
 */
export function localeValue(language: Language, direction: Direction, sample: string): string {
  return isolate(`${language} · ${direction} · ${sample}`);
}
