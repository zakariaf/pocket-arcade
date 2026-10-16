// packages/shell/src/ui/app-text.android.test.tsx
// Runs in the unit-android project (Platform.OS === 'android'). Android lays a line out as CSS
// does: React Native's CustomLineHeightSpan adds half the (negative) leading above the ascent and
// half below the descent, so a Vazirmatn line's overflow is already centred on its line box, as in
// Chrome. iOS puts all of it above the line, which is why the guard moves iOS text down by half the
// overflow; the same shift on Android drew S2's Persian title 2 pt below the design (E18-T20).
import { screen } from '@testing-library/react-native';
import { PixelRatio, StyleSheet } from 'react-native';

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
});
