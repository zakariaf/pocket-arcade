// packages/shell/src/screens/daily/use-next-day-countdown.test.tsx
import { act, renderHook } from '@testing-library/react-native';

import { ServicesProvider } from '@e07/shell/app/services-context.tsx';
import {
  COUNTDOWN_REFRESH_MS,
  useNextDayCountdown,
} from '@e07/shell/screens/daily/use-next-day-countdown.ts';
import { createFakeClock } from '@e07/shell/services/clock/fake-clock.ts';

import type { Services } from '@e07/shell/app/services-context.tsx';
import type { ClockPort } from '@e07/shell/services/clock/clock-port.ts';
import type { ReactNode } from 'react';

/** Only the clock exists; any other port throws and names itself. */
function servicesWith(clock: ClockPort): Services {
  return new Proxy({ clock } as Services, {
    get: (target, name) => {
      if (name === 'clock') return target.clock;
      throw new Error(`test services: no ${String(name)}`);
    },
  });
}

describe('useNextDayCountdown', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows the time left to local midnight and follows the clock', async () => {
    const clock = createFakeClock({
      nowMs: 1_790_424_000_000,
      today: '2026-09-26',
      msUntilNextLocalDay: 11_100_000,
    });
    const wrapper = ({ children }: { readonly children: ReactNode }): ReactNode => (
      <ServicesProvider services={servicesWith(clock)}>{children}</ServicesProvider>
    );
    const { result } = await renderHook(() => useNextDayCountdown(), { wrapper });
    expect(result.current).toStrictEqual({ hours: 3, minutes: 5 });

    await act(() => {
      clock.advance(3 * 3_600_000 + 4 * 60_000 + 30_000);
      jest.advanceTimersByTime(COUNTDOWN_REFRESH_MS);
    });
    expect(result.current).toStrictEqual({ hours: 0, minutes: 1 });
  });
});
