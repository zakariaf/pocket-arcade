// packages/shell/src/app/dialog-context.android.test.tsx
// The Android half of dialog-context.test.tsx, run by the unit-android project (jest-expo/android),
// where react-native's BackHandler is the real Android module: the system back (button or gesture)
// arrives as one 'hardwareBackPress' event, which the navigation container answers with goBack().
import { act, screen, userEvent } from '@testing-library/react-native';
import { BackHandler, DeviceEventEmitter } from 'react-native';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';
import { Button } from '@e07/shell/ui/button.tsx';

import { DialogProvider, useOpenDialog } from './dialog-context.tsx';

import type { ReactNode } from 'react';

/** A stand-in screen whose model opens the reset-statistics dialog. */
function ResetEntry({ onReset }: { readonly onReset: () => void }): ReactNode {
  const openDialog = useOpenDialog();
  return (
    <Button
      testID="stats.reset-button"
      label="Reset statistics"
      onPress={() => {
        openDialog({ kind: 'reset-stats', onConfirm: onReset });
      }}
      isReducedMotion
    />
  );
}

// Spec 5 (the system back does what Back does) and S14: an open dialog's cancel.
describe('DialogProvider and the Android system back', () => {
  it('closes the open dialog without its action, and the screen behind gets no back', async () => {
    const navigatorBack = jest.fn(() => true);
    const subscription = BackHandler.addEventListener('hardwareBackPress', navigatorBack);
    try {
      const onReset = jest.fn();
      const user = userEvent.setup();
      await renderWithShell(
        <DialogProvider>
          <ResetEntry onReset={onReset} />
        </DialogProvider>,
      );
      await user.press(screen.getByTestId('stats.reset-button'));
      expect(screen.getByTestId('reset-stats-dialog.card')).toBeOnTheScreen();

      await act(() => {
        DeviceEventEmitter.emit('hardwareBackPress', {});
      });

      expect(screen.queryByTestId('reset-stats-dialog.card')).toBeNull();
      expect([onReset.mock.calls.length, navigatorBack.mock.calls.length]).toStrictEqual([0, 0]);
      expect(screen.getByTestId('stats.reset-button')).toBeOnTheScreen();
      expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
    } finally {
      subscription.remove();
    }
  });
});
