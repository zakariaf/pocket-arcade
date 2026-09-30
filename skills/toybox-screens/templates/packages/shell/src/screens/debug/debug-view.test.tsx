// packages/shell/src/screens/debug/debug-view.test.tsx
import { screen, userEvent } from '@testing-library/react-native';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { DEBUG_ROWS } from './debug-rows.ts';
import { DebugView } from './debug-view.tsx';

import type { DebugImportField, DebugModel } from './debug-view.tsx';

const CLOSED: DebugImportField = {
  isOpen: false,
  text: '',
  error: null,
  onChangeText: jest.fn(),
  onSubmit: jest.fn(),
  onCancel: jest.fn(),
};

function modelWith(importField: DebugImportField = CLOSED): DebugModel {
  return {
    importField,
    values: { level: '12', date: 'Sunday, 27 Sep', locale: 'en · ltr · 123', errors: '0' },
    networkAttempts: '0',
    switches: { 'ads-always-test': true, 'ads-never': false, premium: false, offline: false },
    isReducedMotion: false,
    onBack: jest.fn(),
    onAction: jest.fn(),
    onToggle: jest.fn(),
  };
}

describe('DebugView', () => {
  it('draws the S15 strip, badge and all fourteen rows', async () => {
    await renderWithShell(<DebugView model={modelWith()} />);

    for (const testID of [
      'debug.screen',
      'debug.hazard-strip',
      'debug.top-bar.title',
      'debug.top-bar.badge',
      'debug.list',
      'debug.jump-to-level-row.value',
      'debug.set-date-row.value',
      'debug.force-locale-row.value',
      'debug.error-log-row.value',
      'debug.ads-always-test-switch.toggle',
      ...DEBUG_ROWS.map((row) => row.testID),
    ]) {
      expect(screen.getByTestId(testID, { includeHiddenElements: true })).toBeOnTheScreen();
    }
    expect(screen.getByTestId('debug.ads-always-test-switch')).toBeChecked();
    expect(screen.getByTestId('debug.network-attempts')).toHaveTextContent('0');

    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('runs actions and flips test switches', async () => {
    const model = modelWith();
    const user = userEvent.setup();
    await renderWithShell(<DebugView model={model} />);

    await user.press(screen.getByTestId('debug.unlock-all-row'));
    await user.press(screen.getByTestId('debug.offline-switch'));

    expect(model.onAction).toHaveBeenCalledWith('unlock-all');
    expect(model.onToggle).toHaveBeenCalledWith('offline');
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('opens the Import save field under the list, imports, and shows why a text was refused', async () => {
    const open: DebugImportField = {
      ...CLOSED,
      isOpen: true,
      onChangeText: jest.fn(),
      onSubmit: jest.fn(),
    };
    const user = userEvent.setup();
    const view = await renderWithShell(<DebugView model={modelWith()} />);
    expect(screen.queryByTestId('debug.import-save-field')).toBeNull();

    await view.rerender(<DebugView model={modelWith(open)} />);
    await user.type(screen.getByTestId('debug.import-save-field'), 'x');
    await user.press(screen.getByTestId('debug.import-save-button'));
    expect(open.onChangeText).toHaveBeenCalledWith('x');
    expect(open.onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('debug.import-save-error')).toBeNull();

    const refused = { ...open, error: 'This is not a saved game: schemaVersion is missing.' };
    await view.rerender(<DebugView model={modelWith(refused)} />);
    expect(screen.getByRole('alert')).toHaveTextContent(refused.error);
    expect(screen.getByTestId('debug.import-save-error')).toBeOnTheScreen();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});
