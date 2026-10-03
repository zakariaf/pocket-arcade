// packages/shell/src/app/dialog-context.test.tsx
import { screen, userEvent } from '@testing-library/react-native';

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

describe('DialogProvider', () => {
  it('opens a dialog above the screen and closes it after the action', async () => {
    const onReset = jest.fn();
    const user = userEvent.setup();
    await renderWithShell(
      <DialogProvider>
        <ResetEntry onReset={onReset} />
      </DialogProvider>,
    );

    await user.press(screen.getByTestId('stats.reset-button'));
    expect(screen.getByTestId('reset-stats-dialog.card')).toBeOnTheScreen();
    await user.press(screen.getByTestId('reset-stats-dialog.confirm-button'));

    expect(onReset).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('reset-stats-dialog.card')).toBeNull();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});
