// packages/shell/src/game-host/realtime-board-host.test.tsx
// The real-time host's lifecycle without a device: Skia's JSI module does not load in the unit
// project (a stub stands in), the loop hook is replaced by a recorder of start/stop calls, and the
// app-active hook is driven by the test.
import { render } from '@testing-library/react-native';
import { Gesture } from 'react-native-gesture-handler';

import { RealtimeBoardHost } from './realtime-board-host.tsx';

import type { BoardColors, RenderKit } from './board-types.ts';
import type { RealtimeBoardHostProps } from './realtime-board-host.tsx';

type Sim = { readonly body: Float32Array };

const mockLoop: {
  start: jest.Mock;
  stop: jest.Mock;
  onEvents: (events: readonly number[]) => void;
} = { start: jest.fn(), stop: jest.fn(), onEvents: () => undefined };
const mockApp = { isActive: true };

// Skia's JSI module does not load in the unit project: inert host components and a stub recorder.
jest.mock('@shopify/react-native-skia', () => {
  const recorder = { beginRecording: () => ({}), finishRecordingAsPicture: () => ({}) };
  const makeRecorder = (): typeof recorder => recorder;
  return { Canvas: 'SkiaCanvas', Picture: 'SkiaPicture', Skia: { PictureRecorder: makeRecorder } };
});
jest.mock('./use-fixed-step-loop.ts', () => ({
  useFixedStepLoop: (input: { onEvents: (events: readonly number[]) => void }) => {
    mockLoop.onEvents = input.onEvents;
    return { start: mockLoop.start, stop: mockLoop.stop };
  },
}));
jest.mock('@e07/shell/app/use-is-app-active.ts', () => ({
  useIsAppActive: () => mockApp.isActive,
}));

const SIM: Sim = { body: new Float32Array([1, 2, 3, 4]) };

function props(overrides: Partial<RealtimeBoardHostProps<Sim, string>> = {}) {
  return {
    initialSim: SIM,
    game: { step: () => undefined, drainEvents: () => [] },
    draw: () => undefined,
    colors: { scheme: 'dark', isColorBlind: false, color: {} } as BoardColors<string>,
    kit: {} as RenderKit,
    makeGesture: () => Gesture.Pan(),
    accessibilityLabel: 'Arena',
    isFocused: true,
    isFullscreenAdShowing: false,
    isPaused: false,
    isEnded: false,
    onEvents: jest.fn(),
    isSavePoint: (events: readonly number[]) => events[0] === 9,
    onSavePoint: jest.fn(),
    onAutoPause: jest.fn(),
    onFailure: jest.fn(),
    ...overrides,
  };
}

describe('RealtimeBoardHost', () => {
  beforeEach(() => {
    mockApp.isActive = true;
  });

  it('starts the loop only when the board may run', async () => {
    const shown = props();
    await render(<RealtimeBoardHost {...shown} />);
    expect(mockLoop.start).toHaveBeenCalledTimes(1);
    expect(mockLoop.stop).not.toHaveBeenCalled();
  });

  it('stops, saves and shows Pause when the app leaves, then never resumes by itself', async () => {
    const shown = props();
    const { rerender } = await render(<RealtimeBoardHost {...shown} />);
    mockApp.isActive = false;
    await rerender(<RealtimeBoardHost {...shown} />);
    expect(mockLoop.stop).toHaveBeenCalledTimes(1);
    expect(shown.onSavePoint).toHaveBeenCalledWith(SIM);
    expect(shown.onAutoPause).toHaveBeenCalledTimes(1);
    mockApp.isActive = true;
    await rerender(<RealtimeBoardHost {...shown} isPaused />);
    expect(mockLoop.start).toHaveBeenCalledTimes(1);
    await rerender(<RealtimeBoardHost {...shown} />);
    expect(mockLoop.start).toHaveBeenCalledTimes(2);
  });

  it('stops without a save point or Pause when the run ends', async () => {
    const shown = props();
    const { rerender } = await render(<RealtimeBoardHost {...shown} />);
    await rerender(<RealtimeBoardHost {...shown} isEnded />);
    expect(mockLoop.stop).toHaveBeenCalledTimes(1);
    expect(shown.onSavePoint).not.toHaveBeenCalled();
    expect(shown.onAutoPause).not.toHaveBeenCalled();
  });

  it('saves at a save-point batch before handing the events on', async () => {
    const shown = props();
    await render(<RealtimeBoardHost {...shown} />);
    mockLoop.onEvents([1, 5, 0]);
    expect(shown.onSavePoint).not.toHaveBeenCalled();
    mockLoop.onEvents([9, 1, 240]);
    expect(shown.onSavePoint).toHaveBeenCalledWith(SIM);
    expect(shown.onEvents).toHaveBeenLastCalledWith([9, 1, 240]);
    const saved = (shown.onSavePoint as jest.Mock).mock.invocationCallOrder[0] ?? 0;
    const handed = (shown.onEvents as jest.Mock).mock.invocationCallOrder[1] ?? 0;
    expect(saved).toBeLessThan(handed);
  });
});
