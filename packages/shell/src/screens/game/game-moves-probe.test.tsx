// packages/shell/src/screens/game/game-moves-probe.test.tsx
import { screen } from '@testing-library/react-native';

import { DebugServicesProvider } from '@e07/shell/app/debug-services-context.tsx';
import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { GameMovesProbe } from './game-moves-probe.tsx';

import type { DebugServices } from '@e07/shell/screens/debug/debug-services.ts';

/** Only isBoardLayoutOn is read; any other member fails the test by name. */
function debugServices(isBoardLayoutOn: boolean): DebugServices {
  return new Proxy({ isBoardLayoutOn: () => isBoardLayoutOn } as DebugServices, {
    get: (target, member) => {
      if (member === 'isBoardLayoutOn') return target.isBoardLayoutOn;
      throw new Error(`GameMovesProbe read debug services .${String(member)}`);
    },
  });
}

describe('GameMovesProbe', () => {
  it('draws the move count for E2E flows while the debug board-layout switch is on', async () => {
    await renderWithShell(
      <DebugServicesProvider services={debugServices(true)}>
        <GameMovesProbe moveCount={12} />
      </DebugServicesProvider>,
    );
    expect(screen.getByTestId('game.moves-label')).toHaveTextContent('12');
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('draws nothing with the switch off, in a store build, or without a run', async () => {
    await renderWithShell(
      <>
        <DebugServicesProvider services={debugServices(false)}>
          <GameMovesProbe moveCount={3} />
        </DebugServicesProvider>
        <GameMovesProbe moveCount={3} />
        <DebugServicesProvider services={debugServices(true)}>
          <GameMovesProbe moveCount={null} />
        </DebugServicesProvider>
      </>,
    );
    expect(screen.queryByTestId('game.moves-label')).not.toBeOnTheScreen();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});
