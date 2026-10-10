// packages/shell/src/screens/daily/use-daily-model.test.tsx
import { renderHook } from '@testing-library/react-native';

import { stripIsolates } from '@e07/shell/i18n/bidi.ts';
import { createFakeClock } from '@e07/shell/services/clock/fake-clock.ts';
import { createHostWrapper } from '@e07/shell/testing/create-host-wrapper.tsx';
import { createTestSave } from '@e07/shell/testing/create-test-save.ts';
import { createShellWrapper } from '@e07/shell/testing/render-with-shell.tsx';

import { useDailyModel } from './use-daily-model.ts';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useIsFocused: () => true,
}));

/** Saturday 2026-09-26, noon: the day the screenshots and flows use. */
const CLOCK = createFakeClock({ nowMs: 1_790_424_000_000, today: '2026-09-26' });

async function dailyModel() {
  const { wrapper } = createShellWrapper({ services: { clock: CLOCK } });
  const { result } = await renderHook(() => useDailyModel(), { wrapper });
  return result.current;
}

describe('useDailyModel', () => {
  it('names today from the Shell clock and the catalogs, with no result before the first game', async () => {
    const model = await dailyModel();

    expect([model.monthText, model.dayText, model.todayResult]).toStrictEqual(['Sep', '26', null]);
    // Free text (weekday and month names) is isolated with FSI/PDI inside the sentence.
    expect(stripIsolates(model.dateText)).toBe('Saturday, 26 Sep');
    expect(model.week).toHaveLength(7);
    expect(model.week.at(-1)).toMatchObject({
      weekdayName: 'Saturday',
      state: 'today',
      isToday: true,
    });
  });

  it("opens today's challenge for Play and Replay, and leaves through Back", async () => {
    const model = await dailyModel();

    model.onPlay();
    model.onReplay();
    model.onBack();

    const today = { start: 'new', ref: { kind: 'daily', date: '2026-09-26' } };
    expect(mockNavigate.mock.calls).toStrictEqual([
      ['Game', today],
      ['Game', today],
    ]);
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it("resumes today's saved daily from Play, and starts it over another day's run (N10)", async () => {
    mockNavigate.mockClear();
    const clock = createFakeClock({ nowMs: 1_790_424_000_000, today: '2026-09-26' });
    const shell = createHostWrapper({ services: { clock, save: createTestSave(clock).save } });
    const { result } = await renderHook(() => useDailyModel(), { wrapper: shell.wrapper });

    shell.host.openSession({ start: 'new', ref: { kind: 'daily', date: '2026-09-26' } });
    result.current.onPlay();
    shell.host.openSession({ start: 'new', ref: { kind: 'daily', date: '2026-09-25' } });
    result.current.onPlay();

    expect(mockNavigate.mock.calls).toStrictEqual([
      ['Game', { start: 'resume' }],
      ['Game', { start: 'new', ref: { kind: 'daily', date: '2026-09-26' } }],
    ]);
  });

  it("ticks no countdown clock before today's game: it shows only with today's result", async () => {
    const interval = jest.spyOn(globalThis, 'setInterval');
    try {
      const clock = createFakeClock({ nowMs: 1_790_424_000_000, today: '2026-09-26' });
      const shell = createHostWrapper({ services: { clock, save: createTestSave(clock).save } });
      await renderHook(() => useDailyModel(), { wrapper: shell.wrapper });

      expect(interval).not.toHaveBeenCalled();
    } finally {
      interval.mockRestore();
    }
  });

  it('plays the day the clock says when Play is pressed, past midnight on an open S9', async () => {
    mockNavigate.mockClear();
    const clock = createFakeClock({ nowMs: 1_790_424_000_000, today: '2026-09-26' });
    const { wrapper } = createShellWrapper({ services: { clock } });
    const { result } = await renderHook(() => useDailyModel(), { wrapper });

    clock.advance(12 * 3_600_000 + 60_000);
    result.current.onPlay();

    expect(mockNavigate.mock.calls).toStrictEqual([
      ['Game', { start: 'new', ref: { kind: 'daily', date: '2026-09-27' } }],
    ]);
  });
});
