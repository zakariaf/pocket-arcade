// packages/shell/src/app/load-outcome-opener.test.tsx
import { fireEvent, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { GameHostProvider } from '@e07/shell/game-host/game-host-context.tsx';
import { createFakeErrorLog } from '@e07/shell/services/error-log/fake-error-log.ts';
import { createTestAdapters } from '@e07/shell/testing/create-test-adapters.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';
import { TALLY_GAME } from '@e07/shell/testing/tally-game.ts';

import { createShellParts } from './create-shell-parts.ts';
import { DialogProvider } from './dialog-context.tsx';
import { LoadOutcomeOpener, loadOutcomeRequest } from './load-outcome-opener.tsx';

import type { LoadOutcome } from '@e07/shell/services/save/load-plan.ts';

// renderWithShell has no game catalogs: the game's name is the only game text this dialog reads.
jest.mock('@e07/shell/i18n/game-message-text.ts', () => ({ gameMessageText: () => 'Tally' }));

let mockAppStoreId: string | undefined;
jest.mock('@e07/shell/app/read-game-extra.ts', () => ({
  readGameExtra: () => ({
    ...jest.requireActual<{ TEST_GAME_EXTRA: object }>('@e07/shell/testing/test-game-extra.ts')
      .TEST_GAME_EXTRA,
    ...(mockAppStoreId === undefined ? {} : { appStoreId: mockAppStoreId }),
  }),
}));

const NEWER_SAVE = { gameName: 'Tally', onUpdate: () => undefined };
const newerSave = () => NEWER_SAVE;

async function renderOutcome(outcome: LoadOutcome) {
  const { host } = createShellParts(
    { game: TALLY_GAME, language: 'en', directionPlan: 'keep' },
    createTestAdapters(),
  );
  const errorLog = createFakeErrorLog();
  await renderWithShell(
    <GameHostProvider host={host}>
      <DialogProvider>
        <LoadOutcomeOpener outcome={outcome} />
      </DialogProvider>
    </GameHostProvider>,
    { services: { errorLog } },
  );
  return { errorLog };
}

describe('loadOutcomeRequest', () => {
  it('asks for "Progress restored" after a backup restore and "please update" for a newer save', () => {
    expect(
      loadOutcomeRequest({ kind: 'restored-from-backup', reason: 'bad json' }, newerSave),
    ).toStrictEqual({
      kind: 'save-restored',
    });
    expect(loadOutcomeRequest({ kind: 'newer-version', found: 9 }, newerSave)).toStrictEqual({
      kind: 'newer-save',
      ...NEWER_SAVE,
    });
  });

  it('asks for nothing after a fresh, normal, migrated or reset load', () => {
    const quiet: readonly LoadOutcome[] = [
      { kind: 'fresh' },
      { kind: 'loaded' },
      { kind: 'migrated', from: 1 },
      { kind: 'reset-after-damage', reason: 'both damaged' },
    ];
    for (const outcome of quiet) expect(loadOutcomeRequest(outcome, newerSave)).toBeNull();
  });
});

describe('LoadOutcomeOpener', () => {
  afterEach(() => {
    mockAppStoreId = undefined;
  });

  it('opens "Progress restored" over the first screen after the save fell back to its backup', async () => {
    await renderOutcome({ kind: 'restored-from-backup', reason: 'bad json' });
    expect(await screen.findByTestId('save-restored-dialog.ok-button')).toBeOnTheScreen();
  });

  it("opens the update dialog for a newer save; Update opens the game's App Store page", async () => {
    mockAppStoreId = '6740000001';
    const openUrl = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await renderOutcome({ kind: 'newer-version', found: 9 });
    await fireEvent.press(await screen.findByTestId('newer-save-dialog.update-button'));
    expect(openUrl.mock.calls.map(([url]) => new URL(url).pathname)).toStrictEqual([
      '/app/id6740000001',
    ]);
  });

  it('opens no dialog after a normal load', async () => {
    await renderOutcome({ kind: 'loaded' });
    expect(screen.queryByTestId('save-restored-dialog.ok-button')).toBeNull();
    expect(screen.queryByTestId('newer-save-dialog.update-button')).toBeNull();
  });
});
