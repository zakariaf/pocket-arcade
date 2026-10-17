// packages/shell/src/game-host/live-run-exit.test.ts
import * as liveRunExitModule from './live-run-exit.ts';
import { createLiveRunExit } from './live-run-exit.ts';

describe('createLiveRunExit (spec S5 and S6: only Pause -> Home leaves a live run)', () => {
  it('leaves through the open Game screen, as its Pause Home key does', () => {
    const calls: string[] = [];
    const exit = createLiveRunExit();
    exit.register(() => calls.push('leave'));
    exit.leave();
    expect(calls).toStrictEqual(['leave']);
  });

  it('does nothing while no Game screen has a live run', () => {
    const calls: string[] = [];
    const exit = createLiveRunExit();
    const unregister = exit.register(() => calls.push('leave'));
    unregister();
    exit.leave();
    expect(calls).toStrictEqual([]);
  });

  it('keeps the newest Game screen when an older one unregisters after it', () => {
    const calls: string[] = [];
    const exit = createLiveRunExit();
    const older = exit.register(() => calls.push('older'));
    exit.register(() => calls.push('newer'));
    older();
    exit.leave();
    expect(calls).toStrictEqual(['newer']);
  });
});

describe('the live-run exit module (test builds only)', () => {
  it('keeps no registry of its own: a store build provides no exit, so nothing registers', () => {
    expect(Object.keys(liveRunExitModule)).not.toContain('LIVE_RUN_EXIT');
  });
});
