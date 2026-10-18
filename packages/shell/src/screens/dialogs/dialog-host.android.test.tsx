// packages/shell/src/screens/dialogs/dialog-host.android.test.tsx
// The Android half of dialog-host.test.tsx, run by the unit-android project (jest-expo/android),
// where react-native's BackHandler is the real Android module. S14 dialogs are drawn above the
// navigator, not as routes, so the system back (button or gesture, one 'hardwareBackPress' event)
// must be the open dialog's cancel and go no further: the screen behind the dialog stays (spec 5).
import { act, screen } from '@testing-library/react-native';
import { BackHandler, DeviceEventEmitter } from 'react-native';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { DialogHost } from './dialog-host.tsx';

import type { DialogRequest } from './dialog-request.ts';

function host(request: DialogRequest | null, onClose: () => void) {
  return <DialogHost request={request} onClose={onClose} isReducedMotion />;
}

/** The system back, as Android delivers it to JavaScript. */
async function pressSystemBack(): Promise<void> {
  await act(() => {
    DeviceEventEmitter.emit('hardwareBackPress', {});
  });
}

/** Stands in for the navigation container's listener, registered before any dialog opens. */
const added: { remove: () => void }[] = [];

describe('DialogHost and the Android system back (spec 5, S14)', () => {
  afterEach(() => {
    for (const subscription of added.splice(0)) subscription.remove();
  });

  it('closes the open dialog without its action, and the screen behind gets no back', async () => {
    const exitApp = jest.spyOn(BackHandler, 'exitApp').mockImplementation(() => undefined);
    const containerBack = jest.fn(() => true);
    added.push(BackHandler.addEventListener('hardwareBackPress', containerBack));
    const onConfirm = jest.fn();
    const onClose = jest.fn();
    await renderWithShell(host({ kind: 'reset-stats', onConfirm }, onClose));

    await pressSystemBack();

    expect([onClose.mock.calls.length, onConfirm.mock.calls.length]).toStrictEqual([1, 0]);
    expect(containerBack).not.toHaveBeenCalled();
    expect(exitApp).not.toHaveBeenCalled();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('cancels every kind of dialog, Later and OK included', async () => {
    jest.spyOn(BackHandler, 'exitApp').mockImplementation(() => undefined);
    const onClose = jest.fn();
    const onRestart = jest.fn();
    const view = await renderWithShell(host({ kind: 'restart-to-apply', onRestart }, onClose));
    await pressSystemBack();
    await view.rerender(host({ kind: 'save-restored' }, onClose));
    await pressSystemBack();

    expect([onClose.mock.calls.length, onRestart.mock.calls.length]).toStrictEqual([2, 0]);
  });

  it('leaves the press to the navigator while no dialog is open', async () => {
    jest.spyOn(BackHandler, 'exitApp').mockImplementation(() => undefined);
    const containerBack = jest.fn(() => true);
    added.push(BackHandler.addEventListener('hardwareBackPress', containerBack));
    const onClose = jest.fn();
    await renderWithShell(host(null, onClose));

    await pressSystemBack();

    expect(containerBack).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });
});
