// packages/shell/src/app/dialog-context.test.tsx
import { screen, userEvent } from '@testing-library/react-native';

import { ParityLaunchContext, parityLaunchTestID } from '@e07/shell/app/parity-launch-marker.tsx';
import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';
import { Button } from '@e07/shell/ui/button.tsx';

import { DialogProvider, useOpenDialog } from './dialog-context.tsx';

import type { ReactNode } from 'react';

type HostNode = { readonly parent: HostNode | null; readonly props: Record<string, unknown> };

/** The nearest ancestor that hides its subtree from TalkBack (Android's focus trap), if any. */
function trapAbove(node: HostNode): HostNode | null {
  for (let at = node.parent; at !== null; at = at.parent) {
    if (at.props['importantForAccessibility'] === 'no-hide-descendants') return at;
  }
  return null;
}

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

  it('hides the screen behind an open dialog from TalkBack, and shows it again after (spec 8.11, S14)', async () => {
    // The Scrim's accessibilityViewIsModal is iOS-only; on Android the host hides what lies behind.
    const user = userEvent.setup();
    await renderWithShell(
      <DialogProvider>
        <ResetEntry onReset={jest.fn()} />
      </DialogProvider>,
    );
    const closed = screen.getByTestId('stats.reset-button');
    expect(trapAbove(closed)).toBeNull();

    await user.press(closed);
    const behind = screen.getByTestId('stats.reset-button', { includeHiddenElements: true });
    expect(trapAbove(behind)).not.toBeNull();
    const card = screen.getByTestId('reset-stats-dialog.card');
    expect(trapAbove(card)).toBeNull();

    await user.press(screen.getByTestId('reset-stats-dialog.cancel-button'));
    const reopened = screen.getByTestId('stats.reset-button');
    expect(trapAbove(reopened)).toBeNull();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it("draws the parity launch's marker once for an open dialog: its layer's, none in the Scrim", async () => {
    // On Android the modal flag is ignored, so a second marker in the Scrim was a duplicate element.
    const user = userEvent.setup();
    await renderWithShell(
      <ParityLaunchContext value="n7">
        <DialogProvider>
          <ResetEntry onReset={jest.fn()} />
        </DialogProvider>
      </ParityLaunchContext>,
    );
    await user.press(screen.getByTestId('stats.reset-button'));

    const markers = screen.getAllByTestId(parityLaunchTestID('n7'), { includeHiddenElements: true });
    expect(markers).toHaveLength(1);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});
