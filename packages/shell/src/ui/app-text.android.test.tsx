// packages/shell/src/ui/app-text.android.test.tsx
// Runs in the unit-android project (Platform.OS === 'android'). Android lays a line out as CSS
// does: React Native's CustomLineHeightSpan adds half the (negative) leading above the ascent and
// half below the descent, so a Vazirmatn line's overflow is already centred on its line box, as in
// Chrome. iOS puts all of it above the line, which is why the guard moves iOS text down by half the
// overflow; the same shift on Android drew S2's Persian title 2 pt below the design (E18-T20).
import { screen } from '@testing-library/react-native';
import { PixelRatio, StyleSheet } from 'react-native';

import { isolate, RLM } from '@e07/shell/i18n/bidi.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { AppText } from './app-text.tsx';

describe('AppText on Android', () => {
  beforeEach(() => {
    jest.spyOn(PixelRatio, 'get').mockReturnValue(3);
  });

  it('keeps a Persian line where the design centres it and lets its frame hold the ink (spec 15.1)', async () => {
    await renderWithShell(
      <AppText text="۵۸" variant="number" testID="stats.overview-card.games-played.value" />,
      { language: 'fa' },
    );

    // The 33 pt line box stays; Android already centres the 14 pt overflow (Vazirmatn's content
    // box is 47 pt at 30 pt), so the pads hold 7 pt of ink above and below without moving it.
    const text = screen.getByText('۵۸');
    expect(text).toHaveStyle({ lineHeight: 33, marginVertical: -7 });
    expect(StyleSheet.flatten(text.props['style'])).toMatchObject({
      paddingTop: 7,
      paddingBottom: 7,
    });
    expect(screen.getByTestId('stats.overview-card.games-played.value')).toHaveTextContent('۵۸');
  });

  it('draws the S2 title on its design line in Persian (spec 15.1)', async () => {
    await renderWithShell(
      <AppText text="زبان خود را انتخاب کنید" variant="title" testID="language-choice.title" />,
      { language: 'fa' },
    );

    // Title: 30 pt at 1.45 on the pixel grid (131/3 pt) in a 47 pt content box: 5/6 pt of
    // overflow on each side, held by 2 pt pads and cancelled by the -2 pt margins.
    const style = StyleSheet.flatten(screen.getByText('زبان خود را انتخاب کنید').props['style']);
    expect({
      paddingTop: Math.round(Number(style.paddingTop) * 3),
      paddingBottom: Math.round(Number(style.paddingBottom) * 3),
      marginTop: Math.round(Number(style.marginTop ?? style.marginVertical) * 3),
    }).toStrictEqual({ paddingTop: 6, paddingBottom: 6, marginTop: -6 });
  });

  it('lets a line end after an in-word hyphen, as the design does, and reads the text as written (spec 15.1)', async () => {
    await renderWithShell(
      <AppText
        text="Persian and Sorani use a right-to-left layout."
        testID="settings-language.direction-note.label"
      />,
    );

    // Android breaks after "right-to-" only with a break point there (E18-T22: S11a's note, S11b's
    // "public-domain"); TalkBack and Maestro read the label without it.
    const text = screen.getByTestId('settings-language.direction-note.label');
    expect(text).toHaveTextContent('Persian and Sorani use a right-\u200Bto-\u200Bleft layout.');
    expect(text.props['accessibilityLabel']).toBe('Persian and Sorani use a right-to-left layout.');
  });

  it('draws a German no-break space in the text’s own font, and reads the text as written (spec 15.1)', async () => {
    await renderWithShell(
      <AppText text={'62\u00A0%'} variant="number" testID="stats.overview-card.win-rate.value" />,
    );

    // Lilita One has no U+00A0, so Android drew the no-break space from a fallback font, 1.7 pt
    // wider than Lilita's space (E18-T23: S10's "62 %" and S12's "1,99 €" in German). A space
    // between two word joiners keeps the line unbroken in the font's own space.
    const text = screen.getByTestId('stats.overview-card.win-rate.value');
    expect(text).toHaveTextContent('62\u2060 \u2060%');
    expect(text.props['accessibilityLabel']).toBe('62\u00A0%');
  });

  it('fills each line before breaking, as the design does, not with the paragraph-optimal breaker (spec 15.1)', async () => {
    await renderWithShell(
      <AppText
        text="Premium is bought through the App Store or Google Play."
        variant="prose"
        testID="privacy-policy.section.purchase.body"
      />,
    );

    // Chrome and iOS fill a line greedily. Android's default high-quality breaker evens the lines
    // of a paragraph out: S11c's purchase text moved "or" to its second line and the backup text
    // "may" (E18-T22), though both fit the first line.
    expect(
      screen.getByTestId('privacy-policy.section.purchase.body').props['textBreakStrategy'],
    ).toBe('simple');
  });
  it('lays a Persian text without letters right to left, as a TextView did (spec N11)', async () => {
    await renderWithShell(
      <AppText text="۲۸ / ۲۷۰" variant="number" testID="stats.levels-card.stars.value" />,
      { language: 'fa' },
    );

    // React Native's prepared text layout reads a text of digits and signs left to right
    // (FIRSTSTRONG_LTR): S10's stars value drew as "۲۸ / ۲۷۰" from the left (E18-T22).
    // The number role's Persian guard puts the testID on a wrapper; the label sits on the Text.
    expect(screen.getByTestId('stats.levels-card.stars.value')).toHaveTextContent(`${RLM}۲۸ / ۲۷۰`);
    expect(screen.getByText(`${RLM}۲۸ / ۲۷۰`).props['accessibilityLabel']).toBe('۲۸ / ۲۷۰');
  });

  it('lays a date of isolated names right to left in Persian and Sorani (spec N11)', async () => {
    const date = `${isolate('یەکشەممە')}، ٢٧ ${isolate('ئەیلوول')}`;
    await renderWithShell(<AppText text={date} testID="daily.today-card.date" />, {
      language: 'ckb',
    });

    expect(screen.getByTestId('daily.today-card.date')).toHaveTextContent(`${RLM}${date}`);
  });

  it('keeps a right-to-left text with a letter, and English, as written (spec N11)', async () => {
    const mixed = `${isolate('Line Siege')} آفلاین کار می‌کند.`;
    await renderWithShell(
      <>
        <AppText text={mixed} testID="privacy-policy.section.game.body" />
        <AppText text="Vazirmatn 33.003" testID="licences.entry-row.vazirmatn.label" />
      </>,
      { language: 'fa' },
    );

    const body = screen.getByTestId('privacy-policy.section.game.body');
    expect(body).toHaveTextContent(mixed);
    expect(body.props['accessibilityLabel']).toBeUndefined();
    expect(screen.getByTestId('licences.entry-row.vazirmatn.label')).toHaveTextContent(
      'Vazirmatn 33.003',
    );
  });

  it('keeps digits as written in a left-to-right layout', async () => {
    await renderWithShell(<AppText text="28 / 270" testID="stats.levels-card.stars.value" />);

    expect(screen.getByTestId('stats.levels-card.stars.value')).toHaveTextContent('28 / 270');
  });
});
