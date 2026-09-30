// packages/shell/src/screens/consent/consent-intro-screen.test.tsx
import { screen, userEvent } from '@testing-library/react-native';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { ConsentIntroScreen } from './consent-intro-screen.tsx';

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
});
