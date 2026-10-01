// packages/shell/src/screens/debug/debug-view.test.tsx
import { screen, userEvent } from '@testing-library/react-native';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { DEBUG_PERF_ROWS, DEBUG_ROWS } from './debug-rows.ts';
import { DebugView } from './debug-view.tsx';

import type { DebugImportField, DebugModel, DebugPerf } from './debug-view.tsx';

const CLOSED: DebugImportField = {
  isOpen: false,
  text: '',
  error: null,
  onChangeText: jest.fn(),
  onSubmit: jest.fn(),
  onCancel: jest.fn(),
};

function perfWith(overrides: Partial<DebugPerf> = {}): DebugPerf {
  return {
    isRecording: false,
    onToggleRecording: jest.fn(),
    onShare: jest.fn(),
    onRunBenchmark: jest.fn(),
    entriesCount: 12,
    summary: 'cold 2 · 1122 ms · save p95 0.41 ms',
    ...overrides,
  };
}

function modelWith(
  importField: DebugImportField = CLOSED,
  perf: DebugPerf = perfWith(),
): DebugModel {
  return {
    importField,
    perf,
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

  it('draws the Performance group below the rows: record, share, benchmark and the summary', async () => {
    const perf = perfWith();
    const user = userEvent.setup();
    await renderWithShell(<DebugView model={modelWith(CLOSED, perf)} />);

    expect(screen.getByRole('header', { name: 'Performance' })).toBeOnTheScreen();
    expect(DEBUG_PERF_ROWS.map((row) => row.testID)).toStrictEqual([
      'debug.perf-record-switch',
      'debug.perf-share-row',
      'debug.perf-benchmark-row',
    ]);
    expect(screen.getByRole('switch', { name: 'Record frame times' })).toBe(
      screen.getByTestId('debug.perf-record-switch'),
    );
    expect(screen.getByTestId('debug.perf-record-switch')).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Share performance report' })).toBe(
      screen.getByTestId('debug.perf-share-row'),
    );
    expect(screen.getByRole('button', { name: 'Run save benchmark' })).toBe(
      screen.getByTestId('debug.perf-benchmark-row'),
    );
    expect(screen.getByTestId('debug.perf-summary')).toHaveTextContent(
      'Performance log: 12 entries · cold 2 · 1122 ms · save p95 0.41 ms',
    );
    await user.press(screen.getByTestId('debug.perf-record-switch'));
    await user.press(screen.getByTestId('debug.perf-share-row'));
    await user.press(screen.getByTestId('debug.perf-benchmark-row'));
    expect(perf.onToggleRecording).toHaveBeenCalledTimes(1);
    expect(perf.onShare).toHaveBeenCalledTimes(1);
    expect(perf.onRunBenchmark).toHaveBeenCalledTimes(1);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('shows the recording switch on, and a log of one entry with no cold start yet', async () => {
    const perf = perfWith({
      isRecording: true,
      entriesCount: 1,
      summary: 'cold 0 · – · save p95 –',
    });
    const view = await renderWithShell(<DebugView model={modelWith(CLOSED, perf)} />);

    expect(screen.getByTestId('debug.perf-record-switch')).toBeChecked();
    expect(screen.getByTestId('debug.perf-record-switch.state')).toHaveTextContent('On');
    expect(screen.getByTestId('debug.perf-summary')).toHaveTextContent(
      'Performance log: 1 entry · cold 0 · – · save p95 –',
    );

    await view.rerender(<DebugView model={modelWith(CLOSED, { ...perf, entriesCount: 0 })} />);
    expect(screen.getByTestId('debug.perf-summary')).toHaveTextContent(
      'Performance log: empty · cold 0 · – · save p95 –',
    );
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
