// packages/shell/src/i18n/t.test.tsx
import { screen } from '@testing-library/react-native';

import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { T } from './t.tsx';
import { TEXT_ALIGN } from './use-localized-text-style.ts';

describe('T', () => {
  it('renders the English sentence with its number', async () => {
    await renderWithShell(
      <T id="home.play-button.continue" values={{ level: 12 }} testID="home.play-label" />,
    );
    expect(screen.getByTestId('home.play-label')).toHaveTextContent('Continue – Level 12');
  });

  it('renders the translated sentence with RTL writing direction and start alignment', async () => {
    await renderWithShell(
      <T
        id="home.play-button.continue"
        values={{ level: 12 }}
        variant="heading"
        testID="home.play-label"
      />,
      { language: 'fa', direction: 'rtl' },
    );
    const label = screen.getByTestId('home.play-label');
    expect(label).toHaveTextContent('ادامه – مرحلهٔ ۱۲');
    expect(label).toHaveStyle({
      writingDirection: 'rtl',
      textAlign: TEXT_ALIGN.start,
      fontFamily: 'Vazirmatn-Bold',
    });
  });
});
