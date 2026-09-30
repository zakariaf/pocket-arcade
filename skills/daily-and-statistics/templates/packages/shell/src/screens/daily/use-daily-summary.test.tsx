// packages/shell/src/screens/daily/use-daily-summary.test.tsx
import { act, renderHook } from '@testing-library/react-native';

import { ServicesProvider } from '@e07/shell/app/services-context.tsx';
import { StoresProvider } from '@e07/shell/app/stores-context.tsx';
import { useDailySummary } from '@e07/shell/screens/daily/use-daily-summary.ts';
import { createFakeClock } from '@e07/shell/services/clock/fake-clock.ts';
import { createShellStores } from '@e07/shell/stores/create-shell-stores.ts';
import { applyRunEnd } from '@e07/shell/stores/run-end.ts';
import { updateAndPublish } from '@e07/shell/stores/update-and-publish.ts';
import { createTestSave } from '@e07/shell/testing/create-test-save.ts';

import type { Services } from '@e07/shell/app/services-context.tsx';
import type { ClockPort } from '@e07/shell/services/clock/clock-port.ts';
import type { ReactNode } from 'react';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual<object>('@react-navigation/native'),
  useIsFocused: () => true,
}));

/** Only the clock exists; any other port throws and names itself. */
function servicesWith(clock: ClockPort): Services {
  return new Proxy({ clock } as Services, {
    get: (target, name) => {
      if (name === 'clock') return target.clock;
      throw new Error(`test services: no ${String(name)}`);
    },
  });
}

describe('useDailySummary', () => {
  it('shows today done after the run-end write and re-reads the day on the next render', async () => {
    const clock = createFakeClock({ nowMs: 1_790_424_000_000, today: '2026-09-26' });
    const { save } = createTestSave(clock);
    const stores = createShellStores(save);
    const wrapper = ({ children }: { readonly children: ReactNode }): ReactNode => (
      <ServicesProvider services={servicesWith(clock)}>
        <StoresProvider stores={stores}>{children}</StoresProvider>
      </ServicesProvider>
    );
    const { result, rerender } = await renderHook(() => useDailySummary(), { wrapper });
    expect(result.current.isDone).toBe(false);

    const end = {
      mode: 'daily',
      date: clock.today(),
      isWon: true,
      score: 90,
      moves: 6,
      playMs: 1000,
      counters: {},
    } as const;
    // The run-end write happens outside React (the game host), like in the app.
    await act(() => {
      updateAndPublish(save, stores, {
        recipe: (doc) => applyRunEnd(doc, end, clock.today()),
        refreshBackup: true,
      });
    });
    expect(result.current.isDone).toBe(true);
    expect(result.current.currentStreak).toBe(1);

    clock.setToday('2026-09-27');
    await rerender({});
    expect(result.current.isDone).toBe(false);
    expect(result.current.currentStreak).toBe(1);
  });
});
