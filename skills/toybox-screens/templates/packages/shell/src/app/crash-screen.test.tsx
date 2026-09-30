// packages/shell/src/app/crash-screen.test.tsx
import { screen, userEvent } from '@testing-library/react-native';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { CrashScreen } from './crash-screen.tsx';

describe('CrashScreen', () => {
  it('offers the one way out, back to Home', async () => {
    const onGoHome = jest.fn();
    const user = userEvent.setup();
    await renderWithShell(<CrashScreen onGoHome={onGoHome} />);

    expect(screen.getByTestId('crash.screen')).toBeOnTheScreen();
    await user.press(screen.getByTestId('crash.home-button'));

    expect(onGoHome).toHaveBeenCalledTimes(1);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});
