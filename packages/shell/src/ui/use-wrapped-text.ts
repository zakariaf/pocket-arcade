// packages/shell/src/ui/use-wrapped-text.ts
import { useState } from 'react';
import { useWindowDimensions } from 'react-native';

export type WrappedText = {
  /** The current text measured on more than one line. */
  readonly isWrapped: boolean;
  /** The current text measured on exactly one line. */
  readonly isOneLine: boolean;
  /** Pass to AppText's onLineCount. */
  readonly onLineCount: (lines: number) => void;
};

export type WrappedTextOptions = {
  /** Once the text wraps, later counts for the same text at the same window width and text size
   * are ignored (a layout that the wrap itself widens never flips back). */
  readonly isSticky: boolean;
};

/**
 * How a text laid out, from AppText's onLineCount: a box that is as wide as its text on one line
 * and fills its row when it wraps. The measure belongs to one text at one window width and text
 * size: a new text (another language, another pack), a rotation, a split view or another text
 * size is unknown again until it is measured, so neither flag is true before that.
 */
export function useWrappedText(text: string, options: WrappedTextOptions): WrappedText {
  const { width, fontScale } = useWindowDimensions();
  const key = `${String(width)}|${String(fontScale)}|${text}`;
  const [measured, setMeasured] = useState<{
    readonly key: string;
    readonly lines: number;
  } | null>(null);
  const lines = measured?.key === key ? measured.lines : null;
  const isWrapped = lines !== null && lines > 1;
  const onLineCount = (count: number): void => {
    // An unchanged count sets nothing: a fresh object would re-render on every layout pass.
    if (count === lines || (options.isSticky && isWrapped)) return;
    setMeasured({ key, lines: count });
  };
  return { isWrapped, isOneLine: lines === 1, onLineCount };
}
