// packages/shell/src/ui/app-text.tsx
import { useState } from 'react';
import { PixelRatio, Platform, Text, View } from 'react-native';

import { isolate } from '@e07/shell/i18n/bidi.ts';
import { useLocalizedTextStyle } from '@e07/shell/i18n/use-localized-text-style.ts';
import { SHELL_COLORS } from '@e07/shell/theme/shell-colors.ts';
import { typeStyleOf } from '@e07/shell/theme/type-styles.ts';
import { useTheme } from '@e07/shell/theme/use-theme.ts';

import { useBalancedWrap } from './use-balanced-wrap.ts';

import type { BalancedWrap } from './use-balanced-wrap.ts';
import type { Direction, Language } from '@e07/shell/i18n/languages.ts';
import type {
  LocalizedTextOptions,
  TextAlignToken,
} from '@e07/shell/i18n/use-localized-text-style.ts';
import type { Theme } from '@e07/shell/theme/theme-types.ts';
import type { TypeStyle } from '@e07/shell/theme/tokens.ts';
import type { TypeVariant } from '@e07/shell/theme/type-styles.ts';
import type { ReactNode } from 'react';
import type { LayoutChangeEvent, TextProps, TextStyle } from 'react-native';

/**
 * default = ink, muted = inkSoft, onPrimary / onPop = text on accent / pop paint,
 * toyInk = printed parts (stickers on gold, accent or pop paper), onInk = white on the ink sticker,
 * toast = text on the inverted toast chip, success / danger = semantic (danger only on surface).
 */
export type TextTone =
  'default' | 'muted' | 'onPrimary' | 'onPop' | 'danger' | 'success' | 'toyInk' | 'onInk' | 'toast';

export type AppTextProps = {
  /** Always the output of t(), a formatter, or an autonym. Never a literal. */
  readonly text: string;
  /** A Toybox type role (display, title, number, heading, body, label, caption) or component style. */
  readonly variant?: TypeVariant;
  readonly tone?: TextTone;
  readonly align?: TextAlignToken;
  /** Only for text in another language than the UI (the language list). */
  readonly language?: Language;
  /**
   * A whole text written in the other direction than the layout ('ltr' for S15's English labels in
   * fa and ckb, L13): laid left to right, still aligned to the layout's start (useLocalizedTextStyle).
   */
  readonly textDirection?: Direction;
  readonly numberOfLines?: number;
  readonly isHeader?: boolean;
  readonly testID?: string;
  /** Called after each text layout with its line count (NotePanel fits a one-line note to its text). */
  readonly onLineCount?: (lines: number) => void;
  /** Called after each text layout with its lines (QuietButton draws its underline under each). */
  readonly onTextLines?: (lines: readonly TextLine[]) => void;
};

/** One laid-out line: its box in the Text, x from the physical left as iOS reports it. */
export type TextLine = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

const UNDERLINE = { textDecorationLine: 'underline' } as const;
const TABULAR: TextStyle = { fontVariant: ['tabular-nums'] };

function toneColor(theme: Theme, tone: TextTone): string {
  const shell = SHELL_COLORS[theme.scheme];
  switch (tone) {
    case 'default':
      return theme.colors.text;
    case 'muted':
      return theme.colors.textMuted;
    case 'onPrimary':
      return theme.colors.onPrimary;
    case 'onPop':
      return theme.colors.onPop;
    case 'danger':
      return theme.colors.danger;
    case 'success':
      return shell.success;
    case 'toyInk':
      return shell.toyInk;
    case 'onInk':
      // White, the same paint as the die-cut ring: printed parts never change with the scheme.
      return shell.cut;
    case 'toast':
      return shell.toastText;
  }
}

function localizedOptions(style: TypeStyle, props: AppTextProps): LocalizedTextOptions {
  return {
    fontSize: style.fontSize,
    weight: style.weight,
    face: style.face,
    lineHeight: style.lineHeight,
    align: props.align ?? 'start',
    ...(style.letterSpacingEm === undefined ? {} : { letterSpacingEm: style.letterSpacingEm }),
    ...(props.language === undefined ? {} : { language: props.language }),
    ...(props.textDirection === undefined ? {} : { textDirection: props.textDirection }),
  };
}

function textProps(props: AppTextProps): TextProps {
  return {
    ...(props.language === undefined ? {} : { accessibilityLanguage: props.language }),
    ...(props.numberOfLines === undefined ? {} : { numberOfLines: props.numberOfLines }),
    ...(props.isHeader === true ? { accessibilityRole: 'header' as const } : {}),
    ...(props.testID === undefined ? {} : { testID: props.testID }),
  };
}

/**
 * Vazirmatn's content box is its rounded hhea ascent plus descent (2100 + 1100 of 2048 per em: 47
 * pt at 30 pt in Chrome's layout), taller than most Toybox Arabic-script lines. Chrome centres the
 * overflow on the line box (half above, half below); iOS puts all of it above the line and clips
 * the Text at its frame. So Persian digits on the tight number lines lost their tops (S10: 17.7
 * pt of ink for 20.7) and every Arabic-script text sat half its overflow higher than the design
 * (S12's 38 pt title: 3 pt). From MIN_SHIFT on, the text gets pads that move the line down by half
 * the overflow and make the frame hold the ink, cancelled by negative margins, inside a wrapper
 * that keeps the design's line box and carries the testID.
 */
const VAZIRMATN_EM = { ascent: 2100 / 2048, descent: 1100 / 2048 } as const;
const MIN_SHIFT = 1.5;

type OverflowGuard = {
  readonly paddingTop: number;
  readonly paddingBottom: number;
  readonly marginVertical: number;
};

/** Chrome's content box of a Vazirmatn line: the rounded ascent plus the rounded descent. */
export function vazirmatnContentHeight(fontSize: number): number {
  return Math.round(VAZIRMATN_EM.ascent * fontSize) + Math.round(VAZIRMATN_EM.descent * fontSize);
}

function overflowGuardOf(style: TextStyle): OverflowGuard | null {
  const size = style.fontSize ?? 0;
  const line = style.lineHeight ?? 0;
  const isArabicFace = (style.fontFamily ?? '').startsWith('Vazirmatn');
  if (!isArabicFace || size === 0) return null;
  const half = (vazirmatnContentHeight(size) - line) / 2;
  if (half < MIN_SHIFT) return null;
  const margin = Math.ceil(half);
  const shift = Platform.OS === 'ios' ? half : 0;
  return { paddingTop: margin + shift, paddingBottom: margin - shift, marginVertical: -margin };
}

/**
 * The variants the design sets with `.d` (CSS text-wrap: balance): the display, title and heading
 * roles, the top bar and dialog titles, the group tab and the score and streak values. Its other
 * Lilita One parts (a key label, .btn .bl; stat values, .sv; stickers, level numbers, the calendar)
 * carry no `.d`, so Chrome wraps them greedily and so does the app.
 */
const BALANCED_VARIANTS: ReadonlySet<TypeVariant> = new Set<TypeVariant>([
  'display',
  'title',
  'heading',
  'topBarTitle',
  'dialogTitle',
  'groupTab',
  'scoreValue',
  'streakValue',
  'gameTopBarScore',
]);

/** Display text balances only in the variants the design marks .d. */
function isBalancedOf(style: TypeStyle, variant: TypeVariant): boolean {
  return style.face === 'display' && BALANCED_VARIANTS.has(variant);
}

/**
 * Room under a text's last line. React Native lays frames out in float32 and draws a text in its
 * frame (minus any pads); far down a scrolled page (S15's font page) a box came out a hair shorter
 * than the lines it measured (174.66650 pt for four 131/3 pt lines), so TextKit dropped the last
 * line: its letters were piled onto the line before or ran off the edge (spec 7.6). Once the text
 * has laid out, its box is one pixel taller than its lines (minHeight) and the margin below gives
 * that pixel back, so the element keeps its line box. A text cut to numberOfLines counts only those.
 */
type TextRoom = { readonly minHeight: number; readonly marginBottom: number };

function roomOf(guard: OverflowGuard | null, lineHeight: number, lines: number): TextRoom {
  const pixel = 1 / PixelRatio.get();
  const pads = guard === null ? 0 : guard.paddingTop + guard.paddingBottom;
  return {
    minHeight: lines * lineHeight + pads + pixel,
    marginBottom: (guard?.marginVertical ?? 0) - pixel,
  };
}

/** A text's vertical metrics: its pads (the guard's) and its line height. */
type LineBox = { readonly pads: number; readonly lineHeight: number };

/**
 * The lines a laid-out box holds, or null when the box is the room set on it (whole lines plus one
 * pixel), which says nothing new. The line report is laid out in the same short box, so it lost
 * the dropped line too (two lines of the ad chip came back as one); the box still measures their
 * height, a hair short, and rounds to the true count.
 */
function boxLinesOf(height: number, box: LineBox): number | null {
  const pixel = 1 / PixelRatio.get();
  if (box.lineHeight === 0) return null;
  const content = height - box.pads;
  const lines = Math.round(content / box.lineHeight);
  return Math.abs(content - lines * box.lineHeight - pixel) < pixel / 4 ? null : lines;
}

/** What a text learned from its layouts: the reported lines and the box's lines when more. */
type Measured = { readonly text: string; readonly lines: number; readonly boxLines: number };

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

/** A report that reaches the box's count has caught up with it: the report counts again. */
function afterReport(measured: Measured, lines: number): Measured {
  return { ...measured, lines, boxLines: lines >= measured.boxLines ? 0 : measured.boxLines };
}

type LineListeners = Pick<AppTextProps, 'onLineCount' | 'onTextLines'>;

type RoomParts = {
  readonly guard: OverflowGuard | null;
  readonly room: TextRoom | null;
  readonly listeners: LineListeners;
  readonly onBoxLayout: (event: LayoutChangeEvent) => void;
};

/** The guard, the room once the line count is known, and the listeners that learn that count. */
function useTextRoom(localized: TextStyle, props: AppTextProps): RoomParts {
  const { text, onLineCount, onTextLines } = props;
  const [stored, setMeasured] = useState<Measured>({ text, lines: 0, boxLines: 0 });
  // A new text starts from nothing.
  const measured = stored.text === text ? stored : { text, lines: 0, boxLines: 0 };
  const guard = overflowGuardOf(localized);
  const box = {
    pads: guard === null ? 0 : guard.paddingTop + guard.paddingBottom,
    lineHeight: localized.lineHeight ?? 0,
  };
  const reported = Math.min(measured.lines, props.numberOfLines ?? measured.lines);
  const count = Math.max(reported, measured.boxLines);
  const forText = (previous: Measured): Measured =>
    previous.text === text ? previous : { text, lines: 0, boxLines: 0 };
  return {
    guard,
    room: count === 0 ? null : roomOf(guard, box.lineHeight, count),
    listeners: {
      onLineCount: (lines) => {
        setMeasured((previous) => afterReport(forText(previous), lines));
        onLineCount?.(lines);
      },
      ...(onTextLines === undefined ? {} : { onTextLines }),
    },
    onBoxLayout: (event) => {
      const held = boxLinesOf(event.nativeEvent.layout.height, box);
      setMeasured((previous) => afterBox(forText(previous), held));
    },
  };
}

function layoutProps(
  balance: BalancedWrap,
  listeners: LineListeners,
  onBoxLayout: (event: LayoutChangeEvent) => void,
): TextProps {
  const { onLineCount, onTextLines } = listeners;
  const onTextLayout: TextProps['onTextLayout'] =
    onLineCount === undefined && onTextLines === undefined
      ? balance.onTextLayout
      : (event) => {
          balance.onTextLayout?.(event);
          const { lines } = event.nativeEvent;
          onLineCount?.(lines.length);
          onTextLines?.(lines.map(({ x, y, width, height }) => ({ x, y, width, height })));
        };
  return {
    onLayout: (event) => {
      balance.onLayout?.(event);
      onBoxLayout(event);
    },
    ...(onTextLayout === undefined ? {} : { onTextLayout }),
  };
}

/** The only component that renders text: role or style, script font, direction, 200% cap. */
export function AppText(props: AppTextProps): ReactNode {
  const theme = useTheme();
  const variant = props.variant ?? 'body';
  const style = typeStyleOf(variant);
  const localized = useLocalizedTextStyle(localizedOptions(style, props));
  // Display text wraps balanced where the design sets .d (text-wrap: balance).
  const balance = useBalancedWrap(isBalancedOf(style, variant), props.text, props.align ?? 'start');
  const decoration = style.isUnderlined === true ? UNDERLINE : null;
  const figures = style.isTabular === true ? TABULAR : null;
  // Game names are Latin brand names: isolate them so an RTL sentence cannot reorder them.
  const shown = style.face === 'brand' ? isolate(props.text) : props.text;
  const { guard, room, listeners, onBoxLayout } = useTextRoom(localized, props);
  const color = { color: toneColor(theme, props.tone ?? 'default') };
  const { testID, ...rest } = props;
  const text = (
    <Text
      style={[localized, decoration, figures, color, balance.style, guard, room]}
      maxFontSizeMultiplier={2}
      {...textProps(guard === null ? props : rest)}
      {...layoutProps(balance, listeners, onBoxLayout)}
    >
      {shown}
    </Text>
  );
  if (guard === null) return text;
  return <View {...(testID === undefined ? {} : { testID })}>{text}</View>;
}
