// packages/shell/src/ui/app-text.test.tsx
import { act, fireEvent, screen } from '@testing-library/react-native';
import { PixelRatio, StyleSheet } from 'react-native';

import { FSI, PDI } from '@e07/shell/i18n/bidi.ts';
import { TEXT_ALIGN } from '@e07/shell/i18n/use-localized-text-style.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';
import { TEST_PALETTE } from '@e07/shell/testing/test-palette.ts';

import { AppText, afterReport, countOf, fitOf } from './app-text.tsx';

import type { useWindowDimensions } from 'react-native';

type WindowMetrics = ReturnType<typeof useWindowDimensions>;

/** The window the text sees: text size 1 normally, the largest accessibility size in one case. */
const mockWindow: { current: WindowMetrics } = {
  current: { width: 402, height: 874, fontScale: 1, scale: 3 },
};
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockWindow.current,
}));

describe('AppText', () => {
  // The parity device (iPhone 16 Pro) draws 3 pixels per point; line heights sit on that grid.
  beforeEach(() => {
    jest.spyOn(PixelRatio, 'get').mockReturnValue(3);
  });

  it('sets display roles in Lilita One with the Latin line height', async () => {
    await renderWithShell(<AppText text="Level 12" variant="display" testID="result.title" />);

    expect(screen.getByTestId('result.title')).toHaveStyle({
      fontFamily: 'LilitaOne',
      fontSize: 38,
      lineHeight: 125 / 3, // 38 x 1.1 = 41.8 on the pixel grid
    });
  });

  it('switches display roles to Vazirmatn Bold in Persian', async () => {
    await renderWithShell(
      <AppText text="مرحله ۱۲" variant="heading" testID="levels.pack-title" />,
      { language: 'fa' },
    );

    expect(screen.getByTestId('levels.pack-title')).toHaveStyle({
      fontFamily: 'Vazirmatn-Bold',
      fontSize: 21,
      lineHeight: 91 / 3, // 21 x 1.45 = 30.45 on the pixel grid
      writingDirection: 'rtl',
    });
  });

  it('lays a whole English label left to right in an RTL layout, aligned to its start (L13)', async () => {
    // S15's labels stay English in fa: still Vazirmatn, but an LTR paragraph, so a wrapped line's
    // trailing space never pushes the first line off the row's start (4.4 pt in the fa capture).
    await renderWithShell(
      <AppText
        text="Force language, direction and digits"
        variant="rowLabel"
        textDirection="ltr"
        testID="debug.force-locale-row.label"
      />,
      { language: 'fa' },
    );

    expect(screen.getByTestId('debug.force-locale-row.label')).toHaveStyle({
      fontFamily: 'Vazirmatn-Regular',
      writingDirection: 'ltr',
      textAlign: TEXT_ALIGN.start, // 'left': React Native swaps it to the right in an RTL layout
    });
  });

  it('lets tall Persian digits overflow a tight number line instead of being clipped (S10)', async () => {
    await renderWithShell(
      <AppText text="۵۸" variant="number" testID="stats.overview-card.games-played.value" />,
      { language: 'fa' },
    );

    // The element keeps the design's 33 pt line box; the text inside moves down by half of the
    // 14 pt overflow (Vazirmatn's content box is 47 pt at 30 pt) and its frame holds the ink.
    const text = screen.getByText('۵۸');
    expect(text).toHaveStyle({ lineHeight: 33, marginVertical: -7 });
    expect(StyleSheet.flatten(text.props['style'])).toMatchObject({
      paddingTop: 14,
      paddingBottom: 0,
    });
    expect(screen.getByTestId('stats.overview-card.games-played.value')).toHaveTextContent('۵۸');
  });

  it('gives a guarded text one pixel of room under its last line (spec 7.6)', async () => {
    await renderWithShell(<AppText text="ا ب پ ت ث ج" variant="title" testID="premium.title" />, {
      language: 'fa',
    });

    // Spec 7.6: every letter is drawn. The guard's 11/3 and 1/3 pt pads come off the frame in
    // float32, and far down a scrolled page the drawn box came out 1.6e-4 pt shorter than the
    // four lines it measured, so TextKit dropped the last line and piled it onto the third. One
    // pixel more box (cancelled below) keeps every line inside it.
    const text = screen.getByText('ا ب پ ت ث ج');
    await fireEvent(text, 'textLayout', {
      nativeEvent: { lines: [{ width: 300 }, { width: 290 }, { width: 300 }, { width: 280 }] },
    });
    const style = StyleSheet.flatten(screen.getByText('ا ب پ ت ث ج').props['style']);
    // In pixels at 3x: four 131 px lines, the 11 px and 1 px pads, one pixel of room; the margin
    // below gives that pixel back, so the element keeps its line box.
    expect({
      minHeight: Math.round(Number(style.minHeight) * 3),
      marginBottom: Math.round(Number(style.marginBottom) * 3),
    }).toStrictEqual({ minHeight: 4 * 131 + 11 + 1 + 1, marginBottom: -(6 + 1) });
    expect(style).toMatchObject({ lineHeight: 131 / 3, marginVertical: -2 });
  });

  it('gives every text one pixel of room under its last line, Latin too (spec 7.6)', async () => {
    await renderWithShell(<AppText text="ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789" />);

    // Far down S15's font page the caption alphabet lost its digits line the same way.
    const text = screen.getByText('ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789');
    await fireEvent(text, 'textLayout', {
      nativeEvent: { lines: [{ width: 380 }, { width: 120 }] },
    });
    const style = StyleSheet.flatten(
      screen.getByText('ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789').props['style'],
    );
    expect({
      minHeight: Math.round(Number(style.minHeight) * 3),
      marginBottom: Math.round(Number(style.marginBottom) * 3),
    }).toStrictEqual({ minHeight: 2 * 67 + 1, marginBottom: -1 });
  });

  it('keeps the room within a text cut to its numberOfLines', async () => {
    await renderWithShell(<AppText text="Line Siege daily" numberOfLines={1} />);

    const text = screen.getByText('Line Siege daily');
    await fireEvent(text, 'textLayout', {
      nativeEvent: { lines: [{ width: 300 }, { width: 80 }] },
    });
    const style = StyleSheet.flatten(screen.getByText('Line Siege daily').props['style']);
    expect(Math.round(Number(style.minHeight) * 3)).toBe(67 + 1);
  });

  it('counts its lines from its laid-out box when the reported lines come out short (spec 7.6)', async () => {
    await renderWithShell(<AppText text="ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz" />);

    // Far down S15's font page the line report is measured in the same short box: two lines of
    // the ad chip came back as one, so the room stayed under the box. The box itself still holds
    // two lines' height, a hair short.
    const text = screen.getByText('ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz');
    await fireEvent(text, 'textLayout', { nativeEvent: { lines: [{ width: 400 }] } });
    await fireEvent(text, 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 400, height: (2 * 67) / 3 - 0.0007 } },
    });
    const style = StyleSheet.flatten(
      screen.getByText('ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz').props['style'],
    );
    expect(Math.round(Number(style.minHeight) * 3)).toBe(2 * 67 + 1);
  });

  it('keeps the box count while its box is the room it set, so the page holds still (spec 7.6)', async () => {
    const words = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789';
    await renderWithShell(<AppText text={words} testID="home.title" />);
    const line = 67 / 3;
    const box = (height: number): unknown => ({
      nativeEvent: { layout: { x: 0, y: 0, width: 400, height } },
    });
    await fireEvent(screen.getByTestId('home.title'), 'textLayout', {
      nativeEvent: { lines: [{ width: 400 }] },
    });
    await fireEvent(screen.getByTestId('home.title'), 'layout', box(2 * line - 0.0007));

    // The room grows the box to two lines and a pixel. Dropping the count there shrank the room,
    // the text grew the box again, and the font page jumped back on every swipe.
    await fireEvent(screen.getByTestId('home.title'), 'layout', box(2 * line + 1 / 3));
    const style = StyleSheet.flatten(screen.getByTestId('home.title').props['style']);
    expect(Math.round(Number(style.minHeight) * 3)).toBe(2 * 67 + 1);
  });

  it('lets a longer box go once the report has caught up with it, in either order (spec 7.6)', async () => {
    const words = 'Größe, Übung, Straße, Züge';
    await renderWithShell(<AppText text={words} testID="home.title" />);
    const line = 67 / 3;
    const lines = (count: number): unknown => ({
      nativeEvent: { lines: Array.from({ length: count }, () => ({ width: 300 })) },
    });
    const box = (height: number): unknown => ({
      nativeEvent: { layout: { x: 0, y: 0, width: 400, height } },
    });
    const title = (): ReturnType<typeof screen.getByTestId> => screen.getByTestId('home.title');
    await fireEvent(title(), 'textLayout', lines(2));

    // A balanced wrap's probe: the three-line box comes before its three-line report. Kept as a
    // count, it grew rows that had already scrolled by, and the font page jumped back.
    await fireEvent(title(), 'layout', box(3 * line));
    await fireEvent(title(), 'textLayout', lines(3));
    await fireEvent(title(), 'textLayout', lines(2));
    await fireEvent(title(), 'layout', box(2 * line + 1 / 3));

    const style = StyleSheet.flatten(title().props['style']);
    expect(Math.round(Number(style.minHeight) * 3)).toBe(2 * 67 + 1);
  });

  it('lets a box go back to its lines once a longer layout has passed (spec 7.6)', async () => {
    const words = 'Größe, Übung, Straße, Züge';
    await renderWithShell(<AppText text={words} testID="home.title" />);
    const line = 67 / 3;
    const lines = (count: number): unknown => ({
      nativeEvent: { lines: Array.from({ length: count }, () => ({ width: 300 })) },
    });
    const box = (height: number): unknown => ({
      nativeEvent: { layout: { x: 0, y: 0, width: 400, height } },
    });
    await fireEvent(screen.getByTestId('home.title'), 'textLayout', lines(2));

    // A longer layout (a balanced wrap's probe) reports three lines and a three-line box in one
    // frame; then the text is back to two lines, in the box the three-line room had grown.
    const handlers = screen.getByTestId('home.title').props as {
      onTextLayout: (event: unknown) => void;
      onLayout: (event: unknown) => void;
    };
    await act(() => {
      handlers.onTextLayout(lines(3));
      handlers.onLayout(box(3 * line));
    });
    await fireEvent(screen.getByTestId('home.title'), 'textLayout', lines(2));
    await fireEvent(screen.getByTestId('home.title'), 'layout', box(3 * line + 1 / 3));

    const style = StyleSheet.flatten(screen.getByTestId('home.title').props['style']);
    expect(Math.round(Number(style.minHeight) * 3)).toBe(2 * 67 + 1);
  });

  it('keeps its laid-out box in the layout when iOS rounds it a pixel above its lines (S10)', async () => {
    // iOS laid the 59/3 pt line of a stat-list key out 20 pt tall. A room of lines + 1 px given
    // back below left the key 19 2/3 pt: every S10 best-scores row came out a pixel short and the
    // card 2 pt short of the design. The room keeps the box iOS laid out and adds its pixel to it.
    await renderWithShell(<AppText text="Levels" variant="statListKey" testID="stats.key" />);
    await fireEvent(screen.getByTestId('stats.key'), 'textLayout', {
      nativeEvent: { lines: [{ width: 44 }] },
    });
    await fireEvent(screen.getByTestId('stats.key'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 44, height: 20 } },
    });

    const style = StyleSheet.flatten(screen.getByTestId('stats.key').props['style']);
    expect({
      minHeight: Math.round(Number(style.minHeight) * 3),
      marginBottom: Math.round(Number(style.marginBottom) * 3),
    }).toStrictEqual({ minHeight: 60 + 1, marginBottom: -1 });
  });

  it('counts its lines in the line height of its text size, up to 200 % (spec 8.11)', async () => {
    // Accessibility XXXL sends fontScale 3.571; the text stops at 2x, its line too (67/3 -> 134/3).
    mockWindow.current = { width: 402, height: 874, fontScale: 3.571, scale: 3 };
    try {
      await renderWithShell(<AppText text="Die Monster sind durchgebrochen" testID="x.note" />);
      const line = 134 / 3;
      const lines = (count: number): unknown => ({
        nativeEvent: { lines: Array.from({ length: count }, () => ({ width: 300 })) },
      });
      const box = (height: number): unknown => ({
        nativeEvent: { layout: { x: 0, y: 0, width: 400, height } },
      });
      const note = (): ReturnType<typeof screen.getByTestId> => screen.getByTestId('x.note');
      await fireEvent(note(), 'textLayout', lines(2));
      await fireEvent(note(), 'layout', box(2 * line));

      // A balanced wrap's three-line probe, then two lines again. Counted in the 1x line, the
      // three-line box read as six lines and the S7 note kept a third, empty line at 200 %.
      await act(() => {
        const handlers = note().props as {
          onTextLayout: (event: unknown) => void;
          onLayout: (event: unknown) => void;
        };
        handlers.onTextLayout(lines(3));
        handlers.onLayout(box(3 * line));
      });
      await fireEvent(note(), 'textLayout', lines(2));
      await fireEvent(note(), 'layout', box(3 * line + 1 / 3));

      const style = StyleSheet.flatten(note().props['style']);
      expect(Math.round(Number(style.minHeight) * 3)).toBe(2 * 134 + 1);
    } finally {
      mockWindow.current = { width: 402, height: 874, fontScale: 1, scale: 3 };
    }
  });

  it('draws Latin numbers without the overflow guard', async () => {
    await renderWithShell(<AppText text="58" variant="number" testID="stats.value" />);

    expect(screen.getByTestId('stats.value')).not.toHaveStyle({ marginVertical: -8 });
  });

  it('sets stat values in tabular figures (the design .sv: font-variant-numeric tabular-nums)', async () => {
    await renderWithShell(<AppText text="۱۱" variant="statValueCompact" testID="stats.value" />, {
      language: 'fa',
    });

    expect(screen.getByText('۱۱')).toHaveStyle({ fontVariant: ['tabular-nums'] });
  });

  it('uses Rubik Bold for button labels', async () => {
    await renderWithShell(<AppText text="Play" variant="label" testID="home.play-label" />);

    expect(screen.getByTestId('home.play-label')).toHaveStyle({ fontFamily: 'Rubik-Bold' });
  });

  it('uses Rubik Regular at 17 pt for body text', async () => {
    await renderWithShell(<AppText text="Hello" testID="home.body" />);

    expect(screen.getByTestId('home.body')).toHaveStyle({
      fontFamily: 'Rubik-Regular',
      fontSize: 17,
      lineHeight: 67 / 3, // 17 x 1.32 = 22.44 on the pixel grid
    });
  });

  it('keeps game names in Lilita One and isolates them in every language', async () => {
    await renderWithShell(<AppText text="Line Siege" variant="gameNameHome" testID="home.name" />, {
      language: 'fa',
    });

    const name = screen.getByTestId('home.name');
    expect(name).toHaveTextContent(`${FSI}Line Siege${PDI}`);
    expect(name).toHaveStyle({ fontFamily: 'LilitaOne', fontSize: 28 });
  });

  it('paints tones from the theme', async () => {
    await renderWithShell(<AppText text="Reset" tone="danger" testID="settings.reset-label" />);

    expect(screen.getByTestId('settings.reset-label')).toHaveStyle({
      color: TEST_PALETTE.standard.light.danger,
    });
  });

  it('marks headings as headers for VoiceOver', async () => {
    await renderWithShell(<AppText text="Settings" variant="topBarTitle" isHeader />);

    expect(screen.getByRole('header', { name: 'Settings' })).toBeOnTheScreen();
  });

  it('reports its laid-out lines to a part drawn under each line (the quiet underline)', async () => {
    const onTextLines = jest.fn();
    await renderWithShell(
      <AppText
        text="Gefällt’s dir? 1,99 €."
        variant="nudge"
        testID="x.nudge"
        onTextLines={onTextLines}
      />,
    );

    await fireEvent(screen.getByTestId('x.nudge'), 'textLayout', {
      nativeEvent: {
        lines: [
          { x: 4, y: 0, width: 255, height: 19, text: 'Gefällt’s dir? ' },
          { x: 100, y: 19, width: 50, height: 19, text: '1,99 €.' },
        ],
      },
    });

    expect(onTextLines).toHaveBeenLastCalledWith([
      { x: 4, y: 0, width: 255, height: 19 },
      { x: 100, y: 19, width: 50, height: 19 },
    ]);
  });
});

describe("AppText's room (pure helpers, at 3 pixels per point)", () => {
  beforeEach(() => {
    jest.spyOn(PixelRatio, 'get').mockReturnValue(3);
  });

  const BOX = { pads: 0, lineHeight: 67 / 3, surplus: 0 };

  it.each([
    { name: 'whole lines', height: 134 / 3, box: BOX, surplus: 0, lines: 2 },
    {
      name: 'the room itself (lines plus a pixel)',
      height: 135 / 3,
      box: BOX,
      surplus: 1 / 3,
      lines: null,
    },
    {
      name: 'a float32 box a hair short (S15)',
      height: 174.6665,
      box: { ...BOX, lineHeight: 131 / 3 },
      surplus: 0,
      lines: 4,
    },
    {
      name: 'no line height yet',
      height: 40,
      box: { ...BOX, lineHeight: 0 },
      surplus: 0,
      lines: null,
    },
  ])('reads $name', ({ height, box, surplus, lines }) => {
    const read = fitOf(height, box);
    expect(read.lines).toBe(lines);
    expect(read.surplus).toBeCloseTo(surplus, 9);
  });

  it.each([
    { lines: 0, boxLines: 0, cap: undefined, count: 0 },
    { lines: 2, boxLines: 0, cap: undefined, count: 2 },
    { lines: 3, boxLines: 0, cap: 2, count: 2 },
    { lines: 1, boxLines: 2, cap: undefined, count: 2 },
    { lines: 3, boxLines: 2, cap: 1, count: 2 },
  ])('holds $lines reported and $boxLines boxed lines (numberOfLines $cap) as $count', (row) => {
    const measured = { text: 't', lines: row.lines, boxLines: row.boxLines, surplus: null };
    expect(countOf(measured, row.cap)).toBe(row.count);
  });

  it('keeps the stored state when a report changes nothing, so React skips the render', () => {
    const measured = { text: 't', lines: 2, boxLines: 0, surplus: 0 };
    expect(afterReport(measured, 2)).toBe(measured);
    const boxed = { ...measured, lines: 1, boxLines: 2 };
    expect(afterReport(boxed, 1)).toBe(boxed);
    expect(afterReport(boxed, 2)).toStrictEqual({ ...measured, lines: 2, boxLines: 0 });
  });
});
