// packages/shell/src/game-host/game-board-host.test.tsx
// no-shell-context: the host takes every port and value as props; the canvas and the frame clock
// (Skia and the UI thread) are replaced by recording stand-ins, so this proves the wiring only.
import { render } from '@testing-library/react-native';

import { EMPTY_HIGHLIGHT } from './board-types.ts';
import { GameBoardHost } from './game-board-host.tsx';

import type { BoardScene } from './board-scene.ts';
import type { BoardColors, BoardHighlight, GameBoard, RenderKit } from './board-types.ts';
import type { GameBoardHostProps } from './game-board-host.tsx';
import type { MoveResult } from './present-move.ts';
import type { Track } from '@e07/game-kit/timeline/track.ts';
import type { AudioPort } from '@e07/shell/services/audio/audio-port.ts';
import type { HapticsPort } from '@e07/shell/services/haptics/haptics-port.ts';

type State = { readonly score: number };
type Event = { readonly kind: 'scored' };
type View = { readonly scoreText: string };

const mockLog: string[] = [];
const mockCanvasProps: { highlight?: BoardHighlight; accessibilityLabel?: string }[] = [];
const mockApp = { isActive: true };
/** The trace sink the host handed the clock (test builds with boardLayout=1). */
const mockClockOptions: { trace?: ((label: string, sample: object) => void) | null } = {};

jest.mock('./board-canvas.tsx', () => {
  const recordProps = (props: { highlight: BoardHighlight; accessibilityLabel: string }): null => {
    mockCanvasProps.push(props);
    return null;
  };
  return { BoardCanvas: recordProps };
});
jest.mock('./use-board-clock.ts', () => ({
  useBoardClock: (
    _initial: unknown,
    _onError: unknown,
    options: { trace: ((label: string, sample: object) => void) | null },
  ) => {
    mockClockOptions.trace = options.trace;
    return {
      push: (scene: BoardScene<View>) => {
        mockLog.push(`push ${String(scene.seq)} ${scene.view.scoreText}`);
      },
      stop: () => {
        mockLog.push('stop');
      },
      resume: () => {
        mockLog.push('resume');
      },
      trace: (label: string) => {
        mockLog.push(`trace ${label}`);
      },
    };
  },
}));
jest.mock('@e07/shell/app/use-is-app-active.ts', () => ({
  useIsAppActive: () => mockApp.isActive,
}));

const BOARD = {
  toView: (state: State) => ({ scoreText: String(state.score) }),
} as unknown as GameBoard<State, View, 'ink'>;
const POP: Track = {
  channel: 'pop',
  entityId: 1,
  startMs: 0,
  durationMs: 100,
  easing: 'linear',
  from: [0],
  to: [1],
  cue: { sound: 'place' },
};

function ports(): { audio: AudioPort; haptics: HapticsPort } {
  const audio = {
    play: (id: string) => mockLog.push(`play ${id}`),
    cancelPending: () => mockLog.push('cancel'),
    suspend: () => {
      mockLog.push('suspend');
      return Promise.resolve();
    },
    resume: () => {
      mockLog.push('audio-resume');
      return Promise.resolve();
    },
  } as unknown as AudioPort;
  return { audio, haptics: { isSupported: true, play: jest.fn() } };
}

function props(
  result: MoveResult<State, Event>,
  extra: Partial<GameBoardHostProps<State, Event, View, 'ink'>> = {},
): GameBoardHostProps<State, Event, View, 'ink'> {
  return {
    board: BOARD,
    buildTimeline: () => [POP],
    result,
    format: { formatNumber: String },
    motion: 'full',
    colors: {} as BoardColors<'ink'>,
    kit: {} as RenderKit,
    highlight: EMPTY_HIGHLIGHT,
    isRtl: false,
    panMode: 'none',
    accessibilityLabel: 'Score 1',
    ...ports(),
    isFocused: true,
    isFullscreenAdShowing: false,
    onIntent: jest.fn(),
    onHover: jest.fn(),
    onFailure: jest.fn(),
    reportError: jest.fn(),
    ...extra,
  };
}

describe('GameBoardHost', () => {
  beforeEach(() => {
    mockLog.length = 0;
    mockCanvasProps.length = 0;
    mockApp.isActive = true;
  });

  it('presents each saved move: old cues cancelled, the final view pushed, new cues played', async () => {
    const view = await render(
      <GameBoardHost {...props({ seq: 1, state: { score: 1 }, events: [] })} />,
    );
    await view.rerender(
      <GameBoardHost {...props({ seq: 2, state: { score: 5 }, events: [{ kind: 'scored' }] })} />,
    );
    expect(mockLog).toStrictEqual([
      'cancel',
      'push 1 1',
      'play place',
      'trace runnable',
      'audio-resume',
      'resume',
      'cancel',
      'push 2 5',
      'play place',
    ]);
  });

  it('passes the host highlight and the translated label to the canvas', async () => {
    const highlight = { selected: { regionId: 'tray', col: 2, row: 0 }, hinted: [] };
    await render(
      <GameBoardHost {...props({ seq: 1, state: { score: 1 }, events: [] }, { highlight })} />,
    );
    expect(mockCanvasProps.at(-1)?.highlight).toBe(highlight);
    expect(mockCanvasProps.at(-1)?.accessibilityLabel).toBe('Score 1');
  });

  it('stops the clock, the cues and the audio when the board may not run', async () => {
    const first = { seq: 1, state: { score: 1 }, events: [] };
    const view = await render(<GameBoardHost {...props(first)} />);
    mockLog.length = 0;
    await view.rerender(<GameBoardHost {...props(first, { isFullscreenAdShowing: true })} />);
    expect(mockLog).toStrictEqual(['trace runnable', 'stop', 'cancel', 'suspend']);
  });

  it('traces the clock with the lifecycle facts only when a trace is given', async () => {
    const first = { seq: 1, state: { score: 1 }, events: [] };
    await render(<GameBoardHost {...props(first)} />);
    expect(mockClockOptions.trace).toBeNull();
    const traced: unknown[] = [];
    const traceClock = (label: string, data: object): void => {
      traced.push([label, data]);
    };
    await render(<GameBoardHost {...props(first, { traceClock, isFullscreenAdShowing: true })} />);
    mockClockOptions.trace?.('push', { seq: 1 });
    expect(traced).toStrictEqual([
      ['push', { seq: 1, isAppActive: true, isFocused: true, isAdShowing: true }],
    ]);
  });
});
