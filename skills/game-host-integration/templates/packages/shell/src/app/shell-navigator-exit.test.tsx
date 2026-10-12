// packages/shell/src/app/shell-navigator-exit.test.tsx
// The live-run exit a test build's debug parts make reaches every screen ShellNavigator hosts, so
// the Game screen's leave is what a debug link's stack reset calls first (spec S5, S6).
import { useLiveRunExit } from '@e07/shell/game-host/live-run-exit.ts';
import { createFakeDebugStore } from '@e07/shell/screens/debug/fake-debug-store.ts';
import { createTestAdapters } from '@e07/shell/testing/create-test-adapters.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';
import { TALLY_GAME } from '@e07/shell/testing/tally-game.ts';

import { createDebugParts } from './create-debug-parts.ts';
import { createShellParts } from './create-shell-parts.ts';
import { ShellNavigator } from './shell-navigator.tsx';

import type { ReactNode } from 'react';

const mockStore = createFakeDebugStore();
jest.mock('@e07/shell/services/save/sqlite-kv-debug-store-adapter.ts', () => ({
  createSqliteKvDebugStoreAdapter: () => mockStore,
}));
jest.mock('@e07/shell/services/save/sqlite-kv-direction-guard-adapter.ts', () => ({
  createSqliteKvDirectionGuardAdapter: () => ({ readPending: () => null, writePending: jest.fn() }),
}));

/** Stands in for the navigation container: a live Game screen offering its leave. */
const mockLeaves: string[] = [];
function MockLiveGameRoot(): ReactNode {
  useLiveRunExit(() => mockLeaves.push('leave'));
  return null;
}
jest.mock('@e07/shell/navigation/navigation-root.tsx', () => ({
  NavigationRoot: MockLiveGameRoot,
}));

describe('ShellNavigator and the live-run exit', () => {
  it("hands a test build's live-run exit to the screens it hosts", async () => {
    const adapters = createTestAdapters({ createDebugParts });
    const parts = createShellParts(
      { game: TALLY_GAME, language: 'en', directionPlan: 'keep' },
      adapters,
    );
    await renderWithShell(
      <ShellNavigator debug={parts.debug} initialState={undefined} loadOutcome={null} />,
    );
    parts.debug.liveRunExit?.leave();
    expect(mockLeaves).toStrictEqual(['leave']);
  });
});
