// packages/shell/src/screens/consent/consent-intro-screen.test.tsx
import { screen, userEvent, within } from '@testing-library/react-native';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { ConsentIntroScreen } from './consent-intro-screen.tsx';

// Spec S3 and L10: the Shell's own short intro appears only when Google's form follows, so its
// footnote (Google's form opens next) is always true.
describe('ConsentIntroScreen', () => {
  it('draws the S3 intro and opens the form from its hero key', async () => {
    const onContinue = jest.fn();
    const user = userEvent.setup();
    await renderWithShell(<ConsentIntroScreen onContinue={onContinue} isReducedMotion={false} />);

    for (const testID of [
      'consent.screen',
      'consent.art',
      'consent.title',
      'consent.body',
      'consent.detail-note',
      'consent.continue-button',
      'consent.footnote',
    ]) {
      expect(screen.getByTestId(testID, { includeHiddenElements: true })).toBeOnTheScreen();
    }
    await user.press(screen.getByRole('button', { name: 'Choose options' }));

    expect(onContinue).toHaveBeenCalledTimes(1);

    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('shows the S3 texts exactly as the copy deck writes them', async () => {
    await renderWithShell(<ConsentIntroScreen onContinue={jest.fn()} isReducedMotion />);

    expect(screen.getByRole('header', { name: 'Ad privacy' })).toBeOnTheScreen();
    expect(
      screen.getByText('Before the first ad, choose your ad privacy options.'),
    ).toBeOnTheScreen();
    expect(
      within(screen.getByTestId('consent.detail-note')).getByText(
        'Ads come from Google. The game itself collects no data.',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Choose options' })).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Google\u2019s form opens next. You can change your choice any time in Settings.',
      ),
    ).toBeOnTheScreen();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('writes the intro in Persian, right to left', async () => {
    await renderWithShell(<ConsentIntroScreen onContinue={jest.fn()} isReducedMotion />, {
      language: 'fa',
    });

    expect(screen.getByRole('header', { name: 'حریم خصوصی تبلیغات' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'انتخاب گزینه‌ها' })).toBeOnTheScreen();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});
