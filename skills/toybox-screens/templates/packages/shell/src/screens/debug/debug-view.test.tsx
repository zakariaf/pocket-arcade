// packages/shell/src/screens/debug/debug-view.test.tsx
import { screen, userEvent } from '@testing-library/react-native';
import { PixelRatio } from 'react-native';

import { TEXT_ALIGN } from '@e07/shell/i18n/use-localized-text-style.ts';
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

/** The fa model: English labels (L13), the values in the language's digits (D65). */
const FA_VALUES: DebugModel['values'] = {
  level: '۱۲',
  date: 'یکشنبه، ۲۷ سپتامبر',
  locale: 'fa · rtl · ۱۲۳',
  errors: '۰',
};

describe('DebugView', () => {
  it('lays the hazard strip first, then the bar with the Test build badge centred in it', async () => {
    await renderWithShell(<DebugView model={modelWith()} />);

    const strip = screen.getByTestId('debug.hazard-strip', { includeHiddenElements: true });
    const bar = screen.getByTestId('debug.top-bar');
    const frame = strip.parent;
    expect(frame?.children.indexOf(strip)).toBeLessThan(frame?.children.indexOf(bar) ?? -1);
    // A Sticker aligns itself to the top of a row; the design centres the badge in the bar
    // (y 94.6 of a bar at 82-148), so it never rides up over the strip (it sat at y 81).
    const badge = screen.getByTestId('debug.top-bar.badge');
    // allow-style-assertion: the badge's wrapper is the fix for the badge drawn 13.6 pt high.
    expect(badge.parent).toHaveStyle({ alignSelf: 'center' });
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it.each([
    ['en', 'Rubik-Regular', 67 / 3],
    ['fa', 'Vazirmatn-Regular', 77 / 3],
  ] as const)(
    'keeps the labels English and flush with the row start in %s (L13)',
    async (language, fontFamily, lineHeight) => {
      jest.spyOn(PixelRatio, 'get').mockReturnValue(3);
      const model = { ...modelWith(), ...(language === 'fa' ? { values: FA_VALUES } : {}) };
      await renderWithShell(<DebugView model={model} />, { language });

      const label = screen.getByTestId('debug.force-locale-row.label');
      expect(label).toHaveTextContent('Force language, direction and digits');
      // An LTR paragraph aligned to the start (React Native swaps 'left' to the right in RTL),
      // in the language's font and line height, as the design draws English in an RTL row.
      // allow-style-assertion: the LTR label at the row start is S15's L13 layout contract.
      expect(label).toHaveStyle({
        fontFamily,
        lineHeight,
        writingDirection: 'ltr',
        textAlign: TEXT_ALIGN.start,
      });
      for (const row of DEBUG_ROWS) {
        // allow-style-assertion: every S15 label is an LTR paragraph (L13), even in fa.
        expect(screen.getByTestId(`${row.testID}.label`)).toHaveStyle({ writingDirection: 'ltr' });
      }
      expect(screen.getByTestId('debug.jump-to-level-row.value')).toHaveTextContent(
        model.values.level,
      );
      expect(screen.getByTestId('debug.top-bar.title')).toHaveTextContent('Debug menu');
      expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
    },
  );

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
