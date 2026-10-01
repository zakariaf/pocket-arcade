// packages/shell/src/ui/text-metrics.ts
// Where Chrome (the Toybox references) puts a line's text: the content box is the font's rounded
// hhea ascent plus rounded descent, centred in the line box; the baseline sits the rounded ascent
// under the content top. iOS lays out a shorter line with all the overflow above it, so parts that
// must line up with the design compute Chrome's numbers instead of reading iOS's.

/** hhea ascent and descent per em of the five Toybox faces (read from the bundled TTFs). */
const FONT_EM: Readonly<Record<string, { readonly ascent: number; readonly descent: number }>> = {
  LilitaOne: { ascent: 0.923, descent: 0.22 },
  'Rubik-Regular': { ascent: 0.935, descent: 0.25 },
  'Rubik-Bold': { ascent: 0.935, descent: 0.25 },
  'Vazirmatn-Regular': { ascent: 2100 / 2048, descent: 1100 / 2048 },
  'Vazirmatn-Bold': { ascent: 2100 / 2048, descent: 1100 / 2048 },
};

export type LineMetrics = {
  /** The rounded ascent (pt). */
  readonly ascent: number;
  /** Rounded ascent plus rounded descent: the content box height (pt). */
  readonly content: number;
};

export function lineMetricsOf(fontFamily: string, fontSize: number): LineMetrics {
  const em = FONT_EM[fontFamily] ?? FONT_EM['Rubik-Regular'] ?? { ascent: 0.935, descent: 0.25 };
  const ascent = Math.round(em.ascent * fontSize);
  return { ascent, content: ascent + Math.round(em.descent * fontSize) };
}

/** Chrome's baseline of a one-line text, from the top of its line box. */
export function chromeBaseline(fontFamily: string, fontSize: number, lineHeight: number): number {
  const { ascent, content } = lineMetricsOf(fontFamily, fontSize);
  return (lineHeight - content) / 2 + ascent;
}
