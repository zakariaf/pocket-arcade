// packages/shell/src/app/shell-navigator.test.tsx
import { fireEvent, screen } from '@testing-library/react-native';

import { GameHostProvider } from '@e07/shell/game-host/game-host-context.tsx';
import { createFakeDebugStore } from '@e07/shell/screens/debug/fake-debug-store.ts';
import { createTestAdapters } from '@e07/shell/testing/create-test-adapters.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';
import { TALLY_GAME } from '@e07/shell/testing/tally-game.ts';
import { AppText } from '@e07/shell/ui/app-text.tsx';
import { Button } from '@e07/shell/ui/button.tsx';

import { createDebugParts } from './create-debug-parts.ts';
import { createShellParts } from './create-shell-parts.ts';
import { useDebugServices } from './debug-services-context.tsx';
import { useOpenDialog } from './dialog-context.tsx';
import { ShellNavigator } from './shell-navigator.tsx';

import type { NavigationRootProps } from '@e07/shell/navigation/navigation-root.tsx';
import type { ReactNode } from 'react';

// The debug parts' key-value stores are expo-sqlite/kv-store on a device; in memory here.
const mockStore = createFakeDebugStore();
jest.mock('@e07/shell/services/save/sqlite-kv-debug-store-adapter.ts', () => ({
  createSqliteKvDebugStoreAdapter: () => mockStore,
}));
jest.mock('@e07/shell/services/save/sqlite-kv-direction-guard-adapter.ts', () => ({
  createSqliteKvDirectionGuardAdapter: () => ({ readPending: () => null, writePending: jest.fn() }),
}));

/** Stands in for the navigation container: what every screen reaches from ShellNavigator. */
function MockProbeRoot(props: NavigationRootProps): ReactNode {
  const openDialog = useOpenDialog();
  const debug = useDebugServices();
  const routes = props.initialState?.routes.map((route) => route.name).join('>') ?? 'Home';
  const handleOpenResetDialog = (): void => {
    debug.setOffline(true);
    openDialog({ kind: 'reset-stats', onConfirm: () => undefined });
  };
  const text = `${routes} ${props.theme.dark ? 'dark' : 'light'} ${props.navigationRef === undefined ? 'no-ref' : 'ref'}`;
  return (
    <>
      <AppText testID="probe.text" text={text} />
      <Button testID="probe.button" label="Probe" onPress={handleOpenResetDialog} isReducedMotion />
      <Button testID="probe.ready" label="Ready" onPress={props.onReady ?? noop} isReducedMotion />
    </>
  );
}
jest.mock('@e07/shell/navigation/navigation-root.tsx', () => ({ NavigationRoot: MockProbeRoot }));

function noop(): void {
  // No onReady in a store build.
}

/** A test build's parts: the real debug services, link handler and navigator ref. */
function testBuildParts() {
  const adapters = createTestAdapters({ createDebugParts });
  const parts = createShellParts(
    { game: TALLY_GAME, language: 'en', directionPlan: 'keep' },
    adapters,
  );
  return { parts, adapters };
}

describe('ShellNavigator', () => {
  it('starts the themed navigator where the launch says and hosts the dialogs and debug services', async () => {
    const { parts } = testBuildParts();
    const resume = { index: 1, routes: [{ name: 'Home' }, { name: 'Game' }] };
    await renderWithShell(
      <ShellNavigator debug={parts.debug} initialState={resume} loadOutcome={null} />,
    );
    expect(screen.getByTestId('probe.text')).toHaveTextContent('Home>Game light ref');
    await fireEvent.press(screen.getByTestId('probe.button'));
    expect(await screen.findByTestId('reset-stats-dialog.confirm-button')).toBeOnTheScreen();
    expect(parts.services.connectivity.isOnline()).toBe(false);
  });

  it('starts the debug link handler when the navigator is ready and stops it on unmount', async () => {
    const { parts } = testBuildParts();
    const stop = jest.fn();
    const links = parts.debug.links;
    if (links === null) throw new Error('a test build has a link handler');
    const start = jest.spyOn(links, 'start').mockReturnValue(stop);
    const view = await renderWithShell(
      <ShellNavigator debug={parts.debug} initialState={undefined} loadOutcome={null} />,
    );
    await fireEvent.press(screen.getByTestId('probe.ready'));
    expect(start).toHaveBeenCalledTimes(1);
    await view.unmount();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("opens the save's load dialog over the first screen (a backup was restored)", async () => {
    const { parts } = testBuildParts();
    await renderWithShell(
      <GameHostProvider host={parts.host}>
        <ShellNavigator
          debug={parts.debug}
          initialState={undefined}
          loadOutcome={{ kind: 'restored-from-backup', reason: 'bad json' }}
        />
      </GameHostProvider>,
    );
    expect(await screen.findByTestId('save-restored-dialog.ok-button')).toBeOnTheScreen();
  });
});
