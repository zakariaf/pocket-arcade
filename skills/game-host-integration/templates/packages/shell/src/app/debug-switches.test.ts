// packages/shell/src/app/debug-switches.test.ts
import { createNavigationContainerRef, StackActions } from '@react-navigation/native';

import { createFrameHistogram } from '@e07/shell/app/perf/frame-histogram.ts';
import { createPerfLog } from '@e07/shell/app/perf/perf-log.ts';
import { createFakeAudio } from '@e07/shell/services/audio/fake-audio.ts';
import { createFakeHaptics } from '@e07/shell/services/haptics/fake-haptics.ts';

import { debugFeedbackOf, debugSwitchesOf } from './debug-switches.ts';

import type { DebugParts } from './create-debug-parts.ts';
import type { FrameHistogram } from '@e07/shell/app/perf/frame-histogram.ts';
import type { DebugServices } from '@e07/shell/screens/debug/debug-services.ts';
import type { ParamListBase } from '@react-navigation/native';

/** Whether this launch is a parity probe=board launch, as TEST_ONLY reports it. */
const mockProbe = { isOn: false };
jest.mock('@e07/shell/app/test-only.ts', () => ({
  TEST_ONLY: { isParityBoardProbeOn: () => mockProbe.isOn },
}));

const NOW = (): number => 1_000;

/** The one perf_log row in memory, as the save database's driver holds it. */
function memoryPerfLog() {
  let payload: string | undefined;
  return createPerfLog({
    exec: () => undefined,
    run: (_sql, params) => {
      payload = String(params[0]);
    },
    get: () => (payload === undefined ? null : { payload }),
    transaction: (work) => {
      work();
    },
  });
}

function partsWith(services: Partial<DebugServices> | null): DebugParts {
  return {
    services: services === null ? null : (services as DebugServices),
    links: null,
    navigationRef: createNavigationContainerRef<ParamListBase>(),
    feedback: null,
  };
}

describe('debugSwitchesOf', () => {
  afterEach(() => {
    mockProbe.isOn = false;
  });

  it('keeps every switch off before the debug parts exist and in a store build', () => {
    const early = debugSwitchesOf(() => null, NOW);
    expect([early.board.isLayoutProbeOn(), early.seedOverride()]).toStrictEqual([false, null]);
    const store = debugSwitchesOf(() => partsWith(null), NOW);
    expect([store.board.isLayoutProbeOn(), store.seedOverride()]).toStrictEqual([false, null]);
  });

  it('turns the board-layout probe on for boardLayout=1 and for a parity probe=board launch', () => {
    const services = { isBoardLayoutOn: () => true, seedOverride: () => 42 };
    const linked = debugSwitchesOf(() => partsWith(services), NOW);
    expect([linked.board.isLayoutProbeOn(), linked.seedOverride()]).toStrictEqual([true, 42]);
    const plain = debugSwitchesOf(() => partsWith({ isBoardLayoutOn: () => false }), NOW);
    expect(plain.board.isLayoutProbeOn()).toBe(false);
    mockProbe.isOn = true;
    expect(plain.board.isLayoutProbeOn()).toBe(true);
  });

  it('traces the board clock into the perf log only while boardLayout=1 is on', () => {
    expect(debugSwitchesOf(() => null, NOW).board.traceClock()).toBeUndefined();
    expect(debugSwitchesOf(() => partsWith(null), NOW).board.traceClock()).toBeUndefined();
    const perfLog = memoryPerfLog();
    const off = { isBoardLayoutOn: () => false, perfLog };
    expect(debugSwitchesOf(() => partsWith(off), NOW).board.traceClock()).toBeUndefined();
    const on = { isBoardLayoutOn: () => true, perfLog };
    const data = {
      ...{ run: 2, seq: 5, startAt: null, elapsedMs: null, endMs: 420 },
      ...{ isAppActive: true, isFocused: true, isAdShowing: false },
    };
    const linked = partsWith(on);
    const switches = debugSwitchesOf(() => linked, NOW);
    expect(switches.board.traceClock()).toBe(switches.board.traceClock());
    switches.board.traceClock()?.('push', data);
    expect(perfLog.entries()).toStrictEqual([
      { kind: 'board-clock', label: 'push', atEpochMs: 1_000, data },
    ]);
  });

  it("feeds S15's frame recorder from the board's frame callback, in a test build only", () => {
    const recorded: FrameHistogram[] = [];
    const frames = {
      histogram: { get: createFrameHistogram, set: (next: FrameHistogram) => recorded.push(next) },
      isRecording: { get: () => true },
    };
    const perf = { frames } as unknown as DebugServices['perf'];
    const parts = partsWith({ perf });
    const switches = debugSwitchesOf(() => parts, NOW);
    const frameTime = switches.board.frameTime();
    expect(frameTime).toBeDefined();
    expect(switches.board.frameTime()).toBe(frameTime); // one function: the frame callback keeps its identity
    frameTime?.(16.7);
    expect(recorded.map((histogram) => histogram.frames)).toStrictEqual([1]);
    expect(debugSwitchesOf(() => partsWith(null), NOW).board.frameTime()).toBeUndefined();
  });

  it('pushes a new Game screen for the debug controls', () => {
    const parts = partsWith(null);
    const dispatch = jest
      .spyOn(parts.navigationRef, 'dispatch')
      .mockImplementation(() => undefined);
    const params = { start: 'new', ref: { kind: 'level', level: 1 } } as const;
    debugSwitchesOf(() => parts, NOW).openGame(params);
    expect(dispatch).toHaveBeenCalledWith(StackActions.push('Game', params));
  });
});

describe('debugFeedbackOf', () => {
  it('plays through the real ports until the debug parts exist, then through their recorders', () => {
    const real = { audio: createFakeAudio(), haptics: createFakeHaptics() };
    const recorded = { audio: createFakeAudio(), haptics: createFakeHaptics() };
    let parts: DebugParts | null = null;
    const feedback = debugFeedbackOf(() => parts, real);
    feedback.audio.play('ui.tap', 0);
    parts = { ...partsWith(null), feedback: recorded };
    feedback.audio.play('ui.win', 120);
    feedback.haptics.play('success');
    expect(real.audio.calls).toStrictEqual([{ kind: 'play', soundId: 'ui.tap', delayMs: 0 }]);
    expect(recorded.audio.calls).toStrictEqual([{ kind: 'play', soundId: 'ui.win', delayMs: 120 }]);
    expect(recorded.haptics.played).toStrictEqual(['success']);
  });

  it('keeps the real ports in a store build (no recorders)', () => {
    const real = { audio: createFakeAudio(), haptics: createFakeHaptics() };
    const feedback = debugFeedbackOf(() => partsWith(null), real);
    feedback.haptics.play('error');
    expect(real.haptics.played).toStrictEqual(['error']);
    expect(feedback.haptics.isSupported).toBe(real.haptics.isSupported);
  });
});
