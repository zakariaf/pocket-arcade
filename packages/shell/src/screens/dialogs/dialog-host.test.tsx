// packages/shell/src/screens/dialogs/dialog-host.test.tsx
import { screen, userEvent } from '@testing-library/react-native';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { DialogHost } from './dialog-host.tsx';

import type { DialogRequest } from './dialog-request.ts';

function host(request: DialogRequest | null, onClose: () => void = jest.fn()) {
  return <DialogHost request={request} onClose={onClose} isReducedMotion />;
}

describe('DialogHost', () => {
  it('draws nothing while no dialog is open', async () => {
    await renderWithShell(host(null));

    expect(
      screen.queryByTestId('reset-stats-dialog.scrim', { includeHiddenElements: true }),
    ).toBeNull();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('runs the action, then closes the dialog', async () => {
    const calls: string[] = [];
    const user = userEvent.setup();
    const request: DialogRequest = { kind: 'reset-stats', onConfirm: () => calls.push('reset') };
    await renderWithShell(host(request, () => calls.push('close')));

    await user.press(screen.getByTestId('reset-stats-dialog.confirm-button'));

    expect(calls).toStrictEqual(['reset', 'close']);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('closes without the action on Later and OK', async () => {
    const onUpdate = jest.fn();
    const onClose = jest.fn();
    const user = userEvent.setup();
    const view = await renderWithShell(
      host({ kind: 'newer-save', gameName: 'Line Siege', onUpdate }, onClose),
    );
    await user.press(screen.getByTestId('newer-save-dialog.later-button'));
    await view.rerender(host({ kind: 'save-restored' }, onClose));
    await user.press(screen.getByTestId('save-restored-dialog.ok-button'));

    expect(onUpdate).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});
