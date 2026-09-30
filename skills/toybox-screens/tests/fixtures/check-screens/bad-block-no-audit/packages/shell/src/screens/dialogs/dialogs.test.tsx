// packages/shell/src/screens/dialogs/dialogs.test.tsx
import { screen, userEvent } from '@testing-library/react-native';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { NewerSaveDialog } from './newer-save-dialog.tsx';
import { ResetProgressDialog } from './reset-progress-dialog.tsx';
import { ResetStatsDialog } from './reset-stats-dialog.tsx';
import { RestartDialog } from './restart-dialog.tsx';
import { RestartLevelDialog } from './restart-level-dialog.tsx';
import { SaveRestoredDialog } from './save-restored-dialog.tsx';

function partsOf(scope: string, parts: readonly string[]): string[] {
  return parts.map((part) => `${scope}.${part}`);
}

describe('S14 dialogs', () => {
  it('draws Reset all progress with the hold button, its hint and Cancel', async () => {
    const onCancel = jest.fn();
    const user = userEvent.setup();
    await renderWithShell(
      <ResetProgressDialog onConfirm={jest.fn()} onCancel={onCancel} isReducedMotion={false} />,
    );

    for (const testID of partsOf('reset-progress-dialog', [
      'scrim',
      'card',
      'art',
      'title',
      'body',
      'confirm-button',
      'confirm-button.fill',
      'hold-hint',
      'cancel-button',
    ]))
      expect(screen.getByTestId(testID, { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByTestId('reset-progress-dialog.hold-hint')).toHaveTextContent(
      'Keep holding for 2 seconds.',
    );
    await user.press(screen.getByTestId('reset-progress-dialog.cancel-button'));
    expect(onCancel).toHaveBeenCalledTimes(1);

    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('draws Restart to apply with the safe choice first', async () => {
    const onRestart = jest.fn();
    const user = userEvent.setup();
    await renderWithShell(
      <RestartDialog onRestart={onRestart} onLater={jest.fn()} isReducedMotion={false} />,
    );

    for (const testID of partsOf('restart-dialog', [
      'scrim',
      'card',
      'art',
      'title',
      'body',
      'buttons',
      'later-button',
      'restart-button',
    ]))
      expect(screen.getByTestId(testID, { includeHiddenElements: true })).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Restart now' }));
    expect(onRestart).toHaveBeenCalledTimes(1);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('draws Progress restored', async () => {
    await renderWithShell(<SaveRestoredDialog onOk={jest.fn()} isReducedMotion={false} />);

    for (const testID of partsOf('save-restored-dialog', [
      'scrim',
      'card',
      'art',
      'title',
      'body',
      'buttons',
      'ok-button',
    ]))
      expect(screen.getByTestId(testID, { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('draws the chosen dialogs the design does not draw', async () => {
    const view = await renderWithShell(
      <RestartLevelDialog onRestart={jest.fn()} onCancel={jest.fn()} isReducedMotion={false} />,
    );
    for (const testID of partsOf('restart-level-dialog', [
      'scrim',
      'card',
      'title',
      'body',
      'buttons',
      'cancel-button',
      'restart-button',
    ]))
      expect(screen.getByTestId(testID, { includeHiddenElements: true })).toBeOnTheScreen();

    await view.rerender(
      <ResetStatsDialog onConfirm={jest.fn()} onCancel={jest.fn()} isReducedMotion={false} />,
    );
    for (const testID of partsOf('reset-stats-dialog', [
      'scrim',
      'card',
      'art',
      'title',
      'body',
      'confirm-button',
      'cancel-button',
    ]))
      expect(screen.getByTestId(testID, { includeHiddenElements: true })).toBeOnTheScreen();

    await view.rerender(
      <NewerSaveDialog
        gameName="Line Siege"
        onUpdate={jest.fn()}
        onLater={jest.fn()}
        isReducedMotion={false}
      />,
    );
    for (const testID of partsOf('newer-save-dialog', [
      'scrim',
      'card',
      'art',
      'title',
      'body',
      'buttons',
      'later-button',
      'update-button',
    ]))
      expect(screen.getByTestId(testID, { includeHiddenElements: true })).toBeOnTheScreen();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});
