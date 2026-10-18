// packages/shell/src/ui/use-text-room.ts
import { useState } from 'react';
import { PixelRatio } from 'react-native';

import { forText } from './use-balanced-wrap.ts';
import { useScaledSize } from './use-scaled-size.ts';

import type { LayoutChangeEvent } from 'react-native';

/** AppText's Persian overflow guard: the pads that hold a Vazirmatn line's ink, and their margins. */
export type OverflowGuard = {
  readonly paddingTop: number;
  readonly paddingBottom: number;
  readonly marginVertical: number;
};

/**
 * Room under a text's last line. React Native lays frames out in float32 and draws a text in its
 * frame (minus any pads); far down a scrolled page (S15's font page) a box came out a hair shorter
 * than the lines it measured (174.66650 pt for four 131/3 pt lines), so TextKit dropped the last
 * line: its letters were piled onto the line before or ran off the edge (spec 7.6). Once the text
 * has laid out, its box is one pixel taller than its lines (minHeight) and the margin below gives
 * that pixel back, so the element keeps its line box. A text cut to numberOfLines counts only those.
 * iOS lays some boxes out a pixel above their lines (a 59/3 pt stat-list key came out 20 pt): that
 * surplus, read from the text's first box, stays in the room, so the element keeps the box iOS
 * laid out (without it every S10 best-scores row came out a pixel short of the design).
 */
type TextRoom = { readonly minHeight: number; readonly marginBottom: number };

/** A text's vertical metrics: its pads (the guard's), its line height and its first box's surplus. */
export type LineBox = {
  readonly pads: number;
  readonly lineHeight: number;
  readonly surplus: number;
};

/** One device pixel in points: the room's extra height and the tolerance of every box reading. */
const pixel = (): number => 1 / PixelRatio.get();

function roomOf(guard: OverflowGuard | null, box: LineBox, lines: number): TextRoom {
  return {
    minHeight: lines * box.lineHeight + box.pads + box.surplus + pixel(),
    marginBottom: (guard?.marginVertical ?? 0) - pixel(),
  };
}

/**
 * What a laid-out box says. surplus: how far it reaches past its whole lines, a pixel at most, none
 * when it is short (the float32 frames far down a page) or within float noise of its lines (read
 * from the first box, laid out before any room, whose own surplus is still 0). lines: the lines it
 * holds, or null when the box is the room set on it (whole lines plus one pixel), which says nothing
 * new. The line report is laid out in the same short box, so it lost the dropped line too (two
 * lines of the ad chip came back as one); the box still measures their height, a hair short, and
 * rounds to the true count.
 */
export function fitOf(
  height: number,
  box: LineBox,
): { readonly surplus: number; readonly lines: number | null } {
  if (box.lineHeight === 0) return { surplus: 0, lines: null };
  const content = height - box.pads - box.surplus;
  const lines = Math.round(content / box.lineHeight);
  const rest = content - lines * box.lineHeight;
  return {
    surplus: rest < pixel() / 4 ? 0 : Math.min(rest, pixel()),
    lines: Math.abs(rest - pixel()) < pixel() / 4 ? null : lines,
  };
}

/**
 * What a text learned from its layouts: the reported lines, the box's lines when more, and the
 * surplus of its first box (laid out before any room: the room waits for a line count).
 */
export type Measured = {
  readonly text: string;
  readonly lines: number;
  readonly boxLines: number;
  readonly surplus: number | null;
};

const freshMeasure = (text: string): Measured => ({ text, lines: 0, boxLines: 0, surplus: null });

/**
 * The lines the room holds: the reported lines (only those numberOfLines shows) or the box's
 * lines when more. 0 while nothing has laid out: no room yet.
 */
export function countOf(measured: Measured, numberOfLines: number | undefined): number {
  const reported = Math.min(measured.lines, numberOfLines ?? measured.lines);
  return Math.max(reported, measured.boxLines);
}

/**
 * A box that holds more lines than the report becomes the count; a box no taller than the report
 * clears it (a longer layout that the report saw too, such as a balanced wrap's probe), and the
 * room's own box keeps it, so the room never shrinks under its text. A report that reaches the
 * count clears it, so a longer box that came before its own report never stays.
 */
function afterBox(measured: Measured, held: number | null): Measured {
  if (held === null) return measured;
  return { ...measured, boxLines: held > measured.lines ? held : 0 };
}

/**
 * A report that reaches the box's count has caught up with it: the report counts again. A report
 * that changes nothing keeps the stored state itself, so React skips the render.
 */
export function afterReport(measured: Measured, lines: number): Measured {
  const boxLines = lines >= measured.boxLines ? 0 : measured.boxLines;
  if (lines === measured.lines && boxLines === measured.boxLines) return measured;
  return { ...measured, lines, boxLines };
}

type RoomParts = {
  readonly room: TextRoom | null;
  /** The line count of each text layout. */
  readonly onLines: (lines: number) => void;
  readonly onBoxLayout: (event: LayoutChangeEvent) => void;
};

/** What the room reads: the text's guard, its 1x line height and how many lines it shows at most. */
export type RoomInput = {
  readonly guard: OverflowGuard | null;
  readonly lineHeight: number;
  readonly numberOfLines: number | undefined;
};

/**
 * AppText's room once the line count is known, and the layout handlers that learn it, for the text
 * as the Text draws it (its layouts report that text's lines).
 */
export function useTextRoom(
  text: string,
  { guard, lineHeight, numberOfLines }: RoomInput,
): RoomParts {
  const [stored, setMeasured] = useState<Measured>(() => freshMeasure(text));
  const measured = forText(stored, text, freshMeasure);
  // The phone draws each line at the line height scaled to the text size (200 % at most; along
  // Android 14's curve there): a box and a room counted in the 1x line read one 200 % line as two,
  // and counted linearly on Android they kept an empty band under the text.
  const box = {
    pads: guard === null ? 0 : guard.paddingTop + guard.paddingBottom,
    lineHeight: useScaledSize()(lineHeight),
    surplus: measured.surplus ?? 0,
  };
  const count = countOf(measured, numberOfLines);
  return {
    room: count === 0 ? null : roomOf(guard, box, count),
    onLines: (lines) => {
      setMeasured((previous) => afterReport(forText(previous, text, freshMeasure), lines));
    },
    onBoxLayout: (event) => {
      const fit = fitOf(event.nativeEvent.layout.height, box);
      setMeasured((previous) => {
        const current = forText(previous, text, freshMeasure);
        const surplus = current.surplus ?? fit.surplus;
        return afterBox(current.surplus === surplus ? current : { ...current, surplus }, fit.lines);
      });
    },
  };
}
