// packages/shell/src/ui/app-text.test.tsx
import { screen } from '@testing-library/react-native';
import { PixelRatio, StyleSheet } from 'react-native';

import { FSI, PDI } from '@e07/shell/i18n/bidi.ts';
import { TEXT_ALIGN } from '@e07/shell/i18n/use-localized-text-style.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';
import { TEST_PALETTE } from '@e07/shell/testing/test-palette.ts';

import { AppText } from './app-text.tsx';

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
});
