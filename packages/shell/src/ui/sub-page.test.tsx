// packages/shell/src/ui/sub-page.test.tsx
import { screen, userEvent } from '@testing-library/react-native';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';
import { AppText } from '@e07/shell/ui/app-text.tsx';

import { SubPage } from './sub-page.tsx';

// Spec S11 and S11a to S11d: each page has its title and Back in the top bar over its body.
describe('SubPage', () => {
  it('draws the screen, the top bar with Back and the body under the base testID', async () => {
    const user = userEvent.setup();
    const onBack = jest.fn();
    await renderWithShell(
      <SubPage
        testIDBase="about"
        title="About"
        backLabel="Back"
        onBack={onBack}
        isReducedMotion={false}
      >
        <AppText testID="probe.body" text="Body" />
      </SubPage>,
    );

    expect(screen.getByTestId('about.screen')).toBeOnTheScreen();
    expect(screen.getByTestId('about.top-bar.title')).toHaveTextContent('About');
    expect(screen.getByTestId('probe.body')).toHaveTextContent('Body');
    await user.press(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('draws a Persian page with its title and Back key', async () => {
    await renderWithShell(
      <SubPage
        testIDBase="licences"
        title="مجوزها"
        backLabel="بازگشت"
        onBack={jest.fn()}
        isReducedMotion
      >
        <AppText testID="probe.body" text="متن" />
      </SubPage>,
      { language: 'fa' },
    );

    expect(screen.getByRole('button', { name: 'بازگشت' })).toBeOnTheScreen();
    expect(screen.getByTestId('licences.top-bar.title')).toHaveTextContent('مجوزها');
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});
