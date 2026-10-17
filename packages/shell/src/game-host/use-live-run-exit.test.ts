// packages/shell/src/game-host/use-live-run-exit.test.ts
// no-shell-context: useLiveRunExit reads only the exit context the test build provides.
import { renderHook } from '@testing-library/react-native';
import { createElement } from 'react';

import { createLiveRunExit, LiveRunExitContext } from './live-run-exit.ts';
import { useLiveRunExit } from './use-live-run-exit.ts';

import type { ReactNode } from 'react';

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

  it('registers nothing while the run is not live (leave null)', async () => {
    const calls: string[] = [];
    const exit = createLiveRunExit();
    exit.register(() => calls.push('older'));
    const wrapper = ({ children }: { readonly children: ReactNode }): ReactNode =>
      createElement(LiveRunExitContext, { value: exit }, children);
    await renderHook(
      () => {
        useLiveRunExit(null);
      },
      { wrapper },
    );
    exit.leave();
    expect(calls).toStrictEqual(['older']);
  });
});
