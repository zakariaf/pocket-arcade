// packages/shell/src/screens/settings/language/use-settings-language-model.test.tsx
import { act, renderHook } from '@testing-library/react-native';

import { PARITY_PLANS } from '@e07/shell/app/parity/parity-plans.ts';
import { endParitySession, startParitySession } from '@e07/shell/app/parity/parity-session.ts';
import { restartForDirection } from '@e07/shell/i18n/direction.ts';
import { createFakeAudio } from '@e07/shell/services/audio/fake-audio.ts';
import { createFakeErrorLog } from '@e07/shell/services/error-log/fake-error-log.ts';
import { createShellWrapper } from '@e07/shell/testing/render-with-shell.tsx';

import { useSettingsLanguageModel } from './use-settings-language-model.ts';

import type { DialogRequest } from '@e07/shell/screens/dialogs/dialog-request.ts';

const mockGoBack = jest.fn();
const mockOpenDialog = jest.fn<undefined, [DialogRequest]>();
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ goBack: mockGoBack }) }));
jest.mock('@e07/shell/app/dialog-context.tsx', () => ({ useOpenDialog: () => mockOpenDialog }));
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'de', languageScriptCode: null }],
}));
jest.mock('@e07/shell/i18n/direction.ts', () => ({
  readLayoutDirection: () => 'ltr',
  restartForDirection: jest.fn(() => Promise.resolve()),
}));
jest.mock('@e07/shell/services/save/sqlite-kv-direction-guard-adapter.ts', () => ({
  createSqliteKvDirectionGuardAdapter: () => ({ readPending: () => null, writePending: jest.fn() }),
}));

async function languageModel() {
  const shell = createShellWrapper({
    services: { audio: createFakeAudio(), errorLog: createFakeErrorLog() },
  });
  const view = await renderHook(() => useSettingsLanguageModel(), { wrapper: shell.wrapper });
  return { ...view, stores: shell.stores };
}

describe('useSettingsLanguageModel', () => {
  it('follows the phone as System and saves a choice without a restart in the same direction', async () => {
    const { result, stores } = await languageModel();
    expect([result.current.selected, result.current.systemLanguage]).toStrictEqual([null, 'de']);

    await act(() => {
      result.current.onSelect('en');
    });
    expect(stores.settings.getState().settings.language).toBe('en');
    expect(result.current.selected).toBe('en');
    expect(mockOpenDialog).not.toHaveBeenCalled();
  });

  it('opens Restart to apply when the direction flips, and restarts only on Restart', async () => {
    const { result } = await languageModel();
    await act(() => {
      result.current.onSelect('fa');
    });
    const [request] = mockOpenDialog.mock.calls.at(-1) ?? [];
    if (request?.kind !== 'restart-to-apply') throw new Error('no restart dialog');
    expect(jest.mocked(restartForDirection)).not.toHaveBeenCalled();

    await act(async () => {
      request.onRestart();
      await Promise.resolve();
    });
    expect(jest.mocked(restartForDirection)).toHaveBeenCalledWith('rtl', expect.anything());
    result.current.onBack();
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('opens Restart to apply in its parity frame without changing the saved language', async () => {
    mockOpenDialog.mockClear();
    startParitySession({
      frame: 's14-restart-to-apply',
      plan: PARITY_PLANS['s14-restart-to-apply'],
      theme: 'light',
      lang: 'en',
      game: 'lineSiege',
      date: '2026-09-27',
      scrollY: 0,
    });
    try {
      const { stores } = await languageModel();
      expect(mockOpenDialog.mock.calls.map(([request]) => request.kind)).toStrictEqual([
        'restart-to-apply',
      ]);
      expect(stores.settings.getState().settings.language).toBeNull();
    } finally {
      endParitySession();
    }
  });
});
