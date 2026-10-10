// packages/shell/src/app/use-today.test.tsx
import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { ServicesProvider } from '@e07/shell/app/services-context.tsx';
import { useToday } from '@e07/shell/app/use-today.ts';
import { createFakeClock } from '@e07/shell/services/clock/fake-clock.ts';

import type { Services } from '@e07/shell/app/services-context.tsx';
import type { ClockPort } from '@e07/shell/services/clock/clock-port.ts';
import type { ReactNode } from 'react';
import type { AppStateStatus } from 'react-native';

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

async function renderToday(clock: ClockPort) {
  const wrapper = ({ children }: { readonly children: ReactNode }): ReactNode => (
    <ServicesProvider services={servicesWith(clock)}>{children}</ServicesProvider>
  );
  return renderHook(() => useToday(), { wrapper });
}

describe('useToday', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reads the day from ClockPort.today() on every render, never a cached one (spec S9)', async () => {
    const clock = createFakeClock({ nowMs: 1_790_424_000_000, today: '2026-09-26' });
    const { result, rerender } = await renderToday(clock);
    expect(result.current).toBe('2026-09-26');

    clock.setToday('2026-09-27');
    await rerender({});
    expect(result.current).toBe('2026-09-27');
  });

  it('reads the day again when the app comes back to the foreground after midnight', async () => {
    const listeners: ((state: AppStateStatus) => void)[] = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      listeners.push(listener);
      return { remove: () => undefined };
    });
    const clock = createFakeClock({ nowMs: 1_790_424_000_000, today: '2026-09-26' });
    const { result } = await renderToday(clock);
    expect(result.current).toBe('2026-09-26');

    clock.setToday('2026-09-27');
    await act(() => {
      for (const listener of listeners) listener('active');
    });
    expect(result.current).toBe('2026-09-27');
  });
  it('reads the day again at local midnight while the screen stays open (spec S9)', async () => {
    jest.useFakeTimers();
    try {
      const clock = createFakeClock({
        nowMs: 1_790_424_000_000,
        today: '2026-09-26',
        msUntilNextLocalDay: 60_000,
      });
      const { result } = await renderToday(clock);
      expect(result.current).toBe('2026-09-26');

      // A minute later the fake clock crosses midnight; nothing else re-renders the screen.
      await act(() => {
        clock.advance(60_000);
        jest.advanceTimersByTime(60_000);
      });
      expect(result.current).toBe('2026-09-27');
    } finally {
      jest.useRealTimers();
    }
  });
});
