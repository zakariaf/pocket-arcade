// packages/shell/src/game-host/use-game-session-controls.test.tsx
// no-shell-context: the tests build their own GameHostProvider around a tally-game host, the only thing the hook reads.
import { act, render, renderHook } from '@testing-library/react-native';

import { createFakeAudio } from '@e07/shell/services/audio/fake-audio.ts';
import { createFakeHaptics } from '@e07/shell/services/haptics/fake-haptics.ts';
import { createTestSave, TEST_CLOCK } from '@e07/shell/testing/create-test-save.ts';
import { TALLY_GAME } from '@e07/shell/testing/tally-game.ts';

import { GameHostProvider, useGameHost } from './game-host-context.tsx';
import { createGameHost } from './game-host.ts';
import { useGameSessionControls } from './use-game-session-controls.ts';

import type { GameFixture } from './game-fixture.ts';
import type { GameHostDeps } from './game-host.ts';
import type { GameParams } from '@e07/shell/navigation/route-params.ts';
import type { ReactNode } from 'react';

/** A parity session of a game frame, as TEST_ONLY reports it (null: a normal launch). */
const mockParity: {
  state: string | null;
  fixture: GameFixture | null;
  isBoardProbe: boolean;
  /** The game facts the hook passed to parityGameFixture. */
  facts: unknown;
} = { state: null, fixture: null, isBoardProbe: false, facts: null };
jest.mock('@e07/shell/app/test-only.ts', () => ({
  TEST_ONLY: {
    parityFrameState: () => mockParity.state,
    parityGameFixture: (facts: unknown) => {
      mockParity.facts = facts;
      return mockParity.fixture;
    },
    isParityBoardProbeOn: () => mockParity.isBoardProbe,
  },
}));

/** The design's numbers for the tally game's frames (moves-rated: par 7). */
const FIXTURE: GameFixture = {
  level: 12,
  score: 1840,
  progress: { mid: { target: 3 }, full: { target: 3 } },
  stars: 3,
  isNewBest: true,
  movesCount: 7,
  par: 7,
  bestScore: 1840,
  loseReasonKey: 'tally.lose.overshot',
  isContinueOffered: true,
};
const LEVEL_1: GameParams = { start: 'new', ref: { kind: 'level', level: 1 } };

function parityFrame(state: string | null, isBoardProbe = false): void {
  mockParity.state = state;
  mockParity.fixture = FIXTURE;
  mockParity.isBoardProbe = isBoardProbe;
}

function hostWrapper(): (props: { readonly children: ReactNode }) => ReactNode {
  const { save } = createTestSave();
  const writeRunEnd: GameHostDeps['writeRunEnd'] = (write) => {
    save.update(write.recipe, { refreshBackup: write.refreshBackup });
  };
  const deps = {
    save,
    clock: TEST_CLOCK,
    errorLog: { record: jest.fn(), entries: () => [] },
    isContinueAllowed: true,
    createBoardHost: () => () => null,
    writeRunEnd,
    feedback: { audio: createFakeAudio(), haptics: createFakeHaptics() },
  };
  const host = createGameHost(TALLY_GAME, deps);
  return function HostWrapper({ children }) {
    return <GameHostProvider host={host}>{children}</GameHostProvider>;
  };
}

async function controlsFor(params: GameParams) {
  return renderHook(() => useGameSessionControls(params), { wrapper: hostWrapper() });
}

describe('useGameSessionControls', () => {
  it('opens a new run and follows pause and resume', async () => {
    const { result } = await controlsFor({ start: 'new', ref: { kind: 'level', level: 1 } });
    expect(result.current.status).toBe('playing');
    await act(() => {
      result.current.pause();
    });
    expect(result.current.status).toBe('paused');
    await act(() => {
      result.current.resume();
    });
    expect(result.current.status).toBe('playing');
    expect(result.current.BoardHost).not.toBeNull();
  });

  it('sends commands to the run and re-renders with its new view', async () => {
    const { result } = await controlsFor({ start: 'new', ref: { kind: 'level', level: 1 } });
    await act(() => {
      result.current.send({
        type: 'intent',
        intent: { kind: 'tap', target: { regionId: 'board', col: 0, row: 0 }, selected: null },
      });
    });
    expect(result.current.view?.moveCount).toBe(1);
  });

  it('starts the next run in the same screen after recording the finished one', async () => {
    const { result } = await controlsFor({ start: 'new', ref: { kind: 'level', level: 1 } });
    for (const col of [1, 1]) {
      await act(() => {
        result.current.send({
          type: 'intent',
          intent: { kind: 'tap', target: { regionId: 'board', col, row: 0 }, selected: null },
        });
      });
    }
    expect(result.current.view?.summary?.nextLevel).toBe(2);
    await act(() => {
      result.current.startRun({ kind: 'level', level: 2 });
    });
    expect(result.current.view).toMatchObject({
      status: 'playing',
      ref: { kind: 'level', level: 2 },
      moveCount: 0,
      summary: null,
    });
  });

  it('reports a missing run so the screen can leave to Home', async () => {
    const { result } = await controlsFor({ start: 'resume' });
    expect(result.current.status).toBe('missing');
    await act(() => {
      result.current.leaveToHome();
    });
    expect(result.current.view).toBeNull();
  });
});

describe('useGameSessionControls in a parity capture of a game frame', () => {
  afterEach(() => {
    mockParity.state = null;
    mockParity.fixture = null;
    mockParity.isBoardProbe = false;
    mockParity.facts = null;
  });

  it("asks for the fixture with the game's facts (the tally game is moves-rated)", async () => {
    parityFrame('pause-open');
    await controlsFor(LEVEL_1);
    expect(mockParity.facts).toStrictEqual({ isScoreRated: false });
  });

  it('opens s6-pause paused, with the design numbers in the top bar', async () => {
    parityFrame('pause-open');
    const { result } = await controlsFor(LEVEL_1);
    expect(result.current.view).toMatchObject({
      status: 'paused',
      ref: { kind: 'level', level: 12 },
      hud: { score: 1840, goal: { kind: 'moves-par', moves: 7, par: 7 } },
    });
  });

  it('opens s7-result-win on the fixture win: 3 stars, New best, level 12', async () => {
    parityFrame('result-win');
    const { result } = await controlsFor(LEVEL_1);
    expect(result.current.view).toMatchObject({
      status: 'won',
      summary: { stars: 3, isNewBest: true, score: 1840, moves: 7, nextLevel: 13 },
    });
  });

  it('opens s7-result-lose on the fixture loss with the continue on offer', async () => {
    parityFrame('result-lose');
    const { result } = await controlsFor(LEVEL_1);
    expect(result.current.view).toMatchObject({
      status: 'lost',
      continueState: 'offered',
      loseReasonKey: 'tally.lose.overshot',
    });
  });

  it('opens no frame state on a normal launch or in the board-layout probe launch', async () => {
    const { result: normal } = await controlsFor(LEVEL_1);
    expect(normal.current.view).toMatchObject({ status: 'playing', hud: { score: 0 } });
    parityFrame('result-win', true);
    const { result: probe } = await controlsFor(LEVEL_1);
    expect(probe.current.view).toMatchObject({ status: 'playing', hud: { score: 0 } });
  });
});

describe('useGameHost', () => {
  it('throws without a provider', async () => {
    function Bare(): ReactNode {
      useGameHost();
      return null;
    }
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(render(<Bare />)).rejects.toThrow(
      'useGameHost() needs a <GameHostProvider> above it',
    );
  });
});
