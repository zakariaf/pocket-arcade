// packages/shell/src/ui/app-text.test.tsx
import { screen } from '@testing-library/react-native';
import { PixelRatio } from 'react-native';

import { FSI, PDI } from '@e07/shell/i18n/bidi.ts';
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
