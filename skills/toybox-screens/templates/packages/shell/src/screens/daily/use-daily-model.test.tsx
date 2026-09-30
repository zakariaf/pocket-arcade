// packages/shell/src/screens/daily/use-daily-model.test.tsx
import { renderHook } from '@testing-library/react-native';

import { stripIsolates } from '@e07/shell/i18n/bidi.ts';
import { createFakeClock } from '@e07/shell/services/clock/fake-clock.ts';
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
});
