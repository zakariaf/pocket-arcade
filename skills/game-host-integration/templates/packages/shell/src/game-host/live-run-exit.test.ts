// packages/shell/src/game-host/live-run-exit.test.ts
// no-shell-context: useLiveRunExit reads only the exit context the test build provides.
import { renderHook } from '@testing-library/react-native';
import { createElement } from 'react';

import * as liveRunExitModule from './live-run-exit.ts';
import { createLiveRunExit, LiveRunExitContext, useLiveRunExit } from './live-run-exit.ts';

import type { ReactNode } from 'react';

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

describe('useLiveRunExit (spec S5 and S6, test builds only)', () => {
  it("offers the Game screen's leave to the exit the test build provides, until it unmounts", async () => {
    const calls: string[] = [];
    const exit = createLiveRunExit();
    const wrapper = ({ children }: { readonly children: ReactNode }): ReactNode =>
      createElement(LiveRunExitContext, { value: exit }, children);
    const view = await renderHook(
      () => {
        useLiveRunExit(() => calls.push('leave'));
      },
      { wrapper },
    );
    exit.leave();
    expect(calls).toStrictEqual(['leave']);
    await view.unmount();
    exit.leave();
    expect(calls).toStrictEqual(['leave']);
  });

  it('keeps no registry of its own: a store build provides no exit, so nothing registers', () => {
    expect(Object.keys(liveRunExitModule)).not.toContain('LIVE_RUN_EXIT');
  });
});
