// packages/shell/src/ui/use-balanced-wrap.ts
// The design sets every display text (.d: headings, titles, dialog titles) with CSS
// `text-wrap: balance`: a heading that needs two lines gets two lines of nearly equal length (the
// narrowest width that keeps its line count), where iOS fills the first line greedily. After a
// layout this hook searches that width from the Text's own line measurements and applies it as a
// pad at the text's end, so the element keeps the full width the design measures.
import { useState } from 'react';

import { isInvisibleMark } from '@e07/shell/i18n/bidi.ts';

import type { TextAlignToken } from '@e07/shell/i18n/use-localized-text-style.ts';
import type { LayoutChangeEvent, TextLayoutEvent, TextStyle } from 'react-native';

const MAX_STEPS = 10;

type Search = {
  /** The text and width the search belongs to: a new text or width starts again. */
  readonly key: string;
  /** Lines at the full width (the count to keep). */
  readonly lines: number;
  /** The widest width known to need more lines (at first the average line) and the narrowest known to keep the count. */
  readonly lo: number;
  readonly hi: number;
  /** The widest line of the layout at hi. */
  readonly widest: number;
  readonly steps: number;
  readonly pad: number;
  /** The pad went back to hi after a probe added a line; the next layout is hi's again. */
  readonly isReturning: boolean;
  readonly isDone: boolean;
};

export type BalancedWrap = {
  readonly style: TextStyle | null;
  readonly onLayout?: (event: LayoutChangeEvent) => void;
  readonly onTextLayout?: (event: TextLayoutEvent) => void;
};

/**
 * The next width to try: half-way between lo and hi, and always narrower than the widest line of
 * the layout at hi. React Native sends no text layout when the lines come out the same as the last
 * ones it sent, so every probe must change the layout from the last one, or the search would wait
 * forever on a width it never measured.
 */
function probeOf(lo: number, hi: number, widest: number): number {
  return Math.floor(Math.min((lo + hi) / 2, widest - 0.5));
}

/** Probe on from the layout at hi, or stop there. */
function probeFrom(search: Search, width: number): Search {
  const probe = probeOf(search.lo, search.hi, search.widest);
  if (search.steps >= MAX_STEPS || probe <= search.lo) {
    return { ...search, pad: Math.max(0, width - search.hi), isReturning: false, isDone: true };
  }
  return { ...search, pad: Math.max(0, width - probe), isReturning: false };
}

/**
 * A probe that failed: it added a line, or it split a word (as surely failed: CSS balance never
 * splits one). The pad goes back to hi first (a wider probe straight after it could lay out the
 * same lines again and send no event), then the search probes between the two.
 */
export function failedSearch(search: Search, width: number): Search {
  const steps = search.steps + 1;
  const tried = width - search.pad;
  const failed = { ...search, steps, lo: tried };
  if (steps >= MAX_STEPS || probeOf(tried, search.hi, search.widest) <= tried) {
    return { ...failed, pad: Math.max(0, width - search.hi), isDone: true };
  }
  return { ...failed, pad: Math.max(0, width - search.hi), isReturning: true };
}

/**
 * Whether a probe failed: it added a line, or it split a word (as surely failed: CSS balance never
 * splits one). A layout back at hi after a failure is no probe.
 */
function isFailedProbe(
  search: Search,
  lineWidths: readonly number[],
  isWordBroken = false,
): boolean {
  return !search.isReturning && (lineWidths.length > search.lines || isWordBroken);
}

/** One text layout: its line widths, and whether it split a word. */
type TextLayout = { readonly lineWidths: readonly number[]; readonly isWordBroken: boolean };

/**
 * One step of the search after a text layout (its line widths alone: a layout that split no
 * word). The one place a probe is judged: one that keeps the count whole narrows on from it, a
 * failed one goes back to hi.
 */
export function nextSearch(
  search: Search,
  width: number,
  layout: TextLayout | readonly number[],
): Search {
  const { lineWidths, isWordBroken } =
    'lineWidths' in layout ? layout : { lineWidths: layout, isWordBroken: false };
  const steps = search.steps + 1;
  const widest = Math.max(...lineWidths);
  if (search.isReturning) return probeFrom({ ...search, steps, widest }, width);
  if (isFailedProbe(search, lineWidths, isWordBroken)) return failedSearch(search, width);
  return probeFrom({ ...search, steps, hi: width - search.pad, widest }, width);
}

const SPACE = /\s/u;
/** A line may end after a space, a hyphen, a dash or a slash, as CSS breaks lines. */
const BREAK_AFTER = /[\s\-\u00AD\u2010\u2012-\u2015/]/u;

/** The nearest visible character (bidi marks and joiners are looked through) before (step -1) or from (step 1) a position, if any. */
function visibleAt(text: string, from: number, step: 1 | -1): string | undefined {
  for (let at = from; at >= 0 && at < text.length; at += step) {
    const char = text.charAt(at);
    if (!isInvisibleMark(char)) return char;
  }
  return undefined;
}

function isWordBreak(text: string, at: number): boolean {
  const before = visibleAt(text, at - 1, -1);
  const after = visibleAt(text, at, 1);
  if (before === undefined || after === undefined) return true;
  return BREAK_AFTER.test(before) || SPACE.test(after);
}

/**
 * Whether a layout broke a line inside a word. iOS wraps a word wider than its line letter by
 * letter, so a narrow probe can keep the line count by splitting a word ("Diesm / al nicht");
 * CSS balance never does. The lines' texts are walked along the text (iOS may leave a line's
 * trailing spaces out); lines without texts, or texts that do not spell the text, say nothing.
 */
export function breaksWord(text: string, lineTexts: readonly (string | undefined)[]): boolean {
  const parts = lineTexts.filter((line): line is string => line !== undefined);
  const squeeze = (value: string): string => value.replace(/\s/gu, '');
  if (parts.length !== lineTexts.length || squeeze(parts.join('')) !== squeeze(text)) return false;
  let at = 0;
  for (const [index, line] of parts.slice(0, -1).entries()) {
    at += line.length;
    if (!isWordBreak(text, at)) return true;
    const next = parts[index + 1] ?? '';
    while (at < text.length && SPACE.test(text.charAt(at)) && !SPACE.test(next.charAt(0))) at += 1;
  }
  return false;
}

/** The first probe after a layout at the full width. */
export function firstSearch(key: string, width: number, lineWidths: readonly number[]): Search {
  const lines = lineWidths.length;
  const widest = Math.max(0, ...lineWidths);
  const start = {
    key,
    lines,
    lo: width,
    hi: width,
    widest,
    steps: 0,
    pad: 0,
    isReturning: false,
    isDone: true,
  };
  if (lines < 2) return start;
  const lo = lineWidths.reduce((sum, line) => sum + line, 0) / lines;
  const probe = probeOf(lo, width, widest);
  if (probe <= lo) return start;
  return { ...start, lo, pad: Math.max(0, width - probe), isDone: false };
}

function padStyle(pad: number, align: TextAlignToken): TextStyle | null {
  if (pad === 0) return null;
  if (align === 'center') return { paddingHorizontal: pad / 2 };
  return align === 'end' ? { paddingStart: pad } : { paddingEnd: pad };
}

export type Measure = {
  readonly text: string;
  readonly width: number;
  /** Line widths of the last text layout, and whether it was at the full width (pad 0). */
  readonly lineWidths: readonly number[] | null;
  readonly search: Search | null;
};

/**
 * The next state after a measurement: the first layout at the full width starts the search, each
 * later layout moves it on (isWordBroken: that layout split a word). onLayout and onTextLayout
 * arrive in either order, so both call it.
 */
export function advance(measure: Measure, isWordBroken = false): Measure {
  const { width, lineWidths, search } = measure;
  if (width === 0 || lineWidths === null || search?.isDone === true) return measure;
  const key = `${String(width)}|${measure.text}`;
  if (search?.key !== key) return { ...measure, search: firstSearch(key, width, lineWidths) };
  return { ...measure, search: nextSearch(search, width, { lineWidths, isWordBroken }) };
}

/** Slack for sub-point rounding between the line widths and the laid-out width. */
const LINE_SLACK = 0.5;

/**
 * A text layout can arrive late, from a wider pad than the one now applied (iOS can report one
 * layout twice). A line wider than the room the current pad leaves proves the layout is not for
 * this pad; one that fits wraps the same at this pad (greedy wrapping), so it counts.
 */
export function isStale(measure: Measure, lineWidths: readonly number[]): boolean {
  if (measure.width === 0) return false;
  const room = measure.width - (measure.search?.pad ?? 0);
  return lineWidths.some((line) => line > room + LINE_SLACK);
}

const EMPTY: Measure = { text: '', width: 0, lineWidths: null, search: null };

/**
 * A state kept for one text: the stored one while it belongs to `text`, else `fresh(text)` (a new
 * text starts from nothing). The balanced wrap and AppText's room both key their state so.
 */
export function forText<T extends { readonly text: string }>(
  stored: T,
  text: string,
  fresh: (text: string) => T,
): T {
  return stored.text === text ? stored : fresh(text);
}

const emptyFor = (text: string): Measure => ({ ...EMPTY, text });

function isSameLines(a: readonly number[] | null, b: readonly number[]): boolean {
  return a !== null && a.length === b.length && a.every((line, index) => line === b[index]);
}

/**
 * The state after a text layout: a stale layout is dropped, any other one is stored and moves the
 * search on. A layout that changes nothing (the same lines, the search not moved) keeps the stored
 * state itself, so React skips the render.
 */
function afterLayout(previous: Measure, text: string, layout: TextLayout): Measure {
  const { lineWidths, isWordBroken } = layout;
  const current = forText(previous, text, emptyFor);
  if (isStale(current, lineWidths)) return previous;
  const next = advance({ ...current, lineWidths }, isWordBroken);
  const isUnchanged =
    current === previous &&
    next.search === previous.search &&
    isSameLines(previous.lineWidths, lineWidths);
  return isUnchanged ? previous : next;
}

/** The state after a text layout that split no word. */
export function afterTextLayout(
  previous: Measure,
  text: string,
  lineWidths: readonly number[],
): Measure {
  return afterLayout(previous, text, { lineWidths, isWordBroken: false });
}

export function useBalancedWrap(
  isEnabled: boolean,
  text: string,
  align: TextAlignToken,
): BalancedWrap {
  const [stored, setMeasure] = useState<Measure>(EMPTY);
  if (!isEnabled) return { style: null };
  const measure = forText(stored, text, emptyFor);
  // Both events can arrive before a re-render: update from the latest state, never a stale closure.
  return {
    style: padStyle(measure.search?.pad ?? 0, align),
    onLayout: (event) => {
      const width = event.nativeEvent.layout.width;
      setMeasure((previous) => {
        const current = forText(previous, text, emptyFor);
        if (Math.abs(width - current.width) <= 0.5) return previous;
        // A new width starts over from the full-width line layout.
        const lineWidths = current.search === null ? current.lineWidths : null;
        return advance({ ...current, width, search: null, lineWidths });
      });
    },
    onTextLayout: (event) => {
      const { lines } = event.nativeEvent;
      const lineWidths = lines.map((line) => line.width);
      const isWordBroken = breaksWord(
        text,
        lines.map((line) => line.text),
      );
      setMeasure((previous) => afterLayout(previous, text, { lineWidths, isWordBroken }));
    },
  };
}
