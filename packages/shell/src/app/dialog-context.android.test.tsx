// packages/shell/src/app/dialog-context.android.test.tsx
// The Android half of dialog-context.test.tsx, run by the unit-android project (jest-expo/android),
// where react-native's BackHandler is the real Android module: the system back (button or gesture)
// arrives as one 'hardwareBackPress' event, which the navigation container answers with goBack().
import { act, screen, userEvent } from '@testing-library/react-native';
import { BackHandler, DeviceEventEmitter, View } from 'react-native';

import { ModalLayer } from '@e07/shell/app/modal-layer.tsx';
import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';
import { Button } from '@e07/shell/ui/button.tsx';

import { DialogProvider, useOpenDialog } from './dialog-context.tsx';

import type { ReactNode } from 'react';

/** The system back, as Android delivers it to JavaScript. */
async function pressSystemBack(): Promise<void> {
  await act(() => {
    DeviceEventEmitter.emit('hardwareBackPress', {});
  });
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

type CoveredAppProps = {
  readonly isCoverUp: boolean;
  readonly onCoverBack: () => void;
  readonly onReset: () => void;
  /** Any value: a new one re-renders the app under the cover, and so the DialogProvider. */
  readonly renderKey: number;
};

/** ConsentMoment's shape: the S3 cover is a ModalLayer over the app, whose navigator sits in a DialogProvider. */
function CoveredApp({ isCoverUp, onCoverBack, onReset, renderKey }: CoveredAppProps): ReactNode {
  return (
    <ModalLayer
      behind={
        <DialogProvider>
          <ResetEntry key="entry" onReset={onReset} />
          <View testID={`probe.render-${String(renderKey)}`} />
        </DialogProvider>
      }
      layer={isCoverUp ? <View testID="probe.consent-cover" /> : null}
      onBack={onCoverBack}
    />
  );
}

// Spec S3 and S14: the system back belongs to the top layer. The S3 cover lies over everything,
// so with a dialog open under it the back stays on S3 and the hidden dialog stays open.
describe('DialogProvider under the S3 consent cover on Android', () => {
  it('keeps the back on the cover drawn over an open dialog, also after the app re-renders', async () => {
    const onCoverBack = jest.fn();
    const onReset = jest.fn();
    const user = userEvent.setup();
    const props = { onCoverBack, onReset };
    const view = await renderWithShell(<CoveredApp isCoverUp={false} renderKey={0} {...props} />);
    await user.press(screen.getByTestId('stats.reset-button'));
    await view.rerender(<CoveredApp isCoverUp renderKey={0} {...props} />);
    await view.rerender(<CoveredApp isCoverUp renderKey={1} {...props} />);

    await pressSystemBack();

    expect(onCoverBack).toHaveBeenCalledTimes(1);
    expect(
      screen.getByTestId('reset-stats-dialog.card', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
  });

  it('keeps the back on the cover when a dialog opens under it', async () => {
    const onCoverBack = jest.fn();
    const user = userEvent.setup();
    await renderWithShell(
      <CoveredApp isCoverUp renderKey={0} onCoverBack={onCoverBack} onReset={jest.fn()} />,
    );
    await user.press(screen.getByTestId('stats.reset-button', { includeHiddenElements: true }));

    await pressSystemBack();

    expect(onCoverBack).toHaveBeenCalledTimes(1);
    expect(
      screen.getByTestId('reset-stats-dialog.card', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
  });

  it('gives the back to the dialog again once the cover is gone', async () => {
    const onCoverBack = jest.fn();
    const props = { onCoverBack, onReset: jest.fn() };
    const user = userEvent.setup();
    const view = await renderWithShell(<CoveredApp isCoverUp renderKey={0} {...props} />);
    await user.press(screen.getByTestId('stats.reset-button', { includeHiddenElements: true }));
    await view.rerender(<CoveredApp isCoverUp={false} renderKey={0} {...props} />);

    await pressSystemBack();

    expect(onCoverBack).not.toHaveBeenCalled();
    expect(screen.queryByTestId('reset-stats-dialog.card')).toBeNull();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});
