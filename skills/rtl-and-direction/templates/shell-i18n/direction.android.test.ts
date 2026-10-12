// packages/shell/src/i18n/direction.android.test.ts
// The Android half of direction.test.ts, run by the unit-android project (jest-expo/android), where
// react-native's I18nManager is the Android module (it forwards allowRTL and forceRTL to the native
// I18nUtil, which keeps them in the app's preferences until the reload reads them back). Spec N6:
// right-to-left is a first-class target; the switch reloads exactly once, after the choice is saved.
import { reloadAppAsync } from 'expo';
import { Platform } from 'react-native';

import { createNumberFormatter } from './create-number-formatter.ts';
import { localeTagFor } from './digits.ts';
import { planDirection } from './direction-plan.ts';
import { readLayoutDirection, restartForDirection } from './direction.ts';
import { FONT_FAMILIES, scriptFontFor } from './fonts.ts';

import type { DirectionGuard } from './direction-guard.ts';
import type { Direction } from './languages.ts';

jest.mock('expo', () => ({ reloadAppAsync: jest.fn(() => Promise.resolve()) }));

/** One ordered log of everything the restart touches: the guard, I18nManager and the reload. */
const mockCalls: string[] = [];

// The real Android I18nManager (only direction.ts may import it), with each call logged first.
jest.mock('react-native/Libraries/ReactNative/I18nManager', () => {
  const actual = jest.requireActual<{
    default: { allowRTL: (isAllowed: boolean) => void; forceRTL: (isForced: boolean) => void };
  }>('react-native/Libraries/ReactNative/I18nManager').default;
  return {
    __esModule: true,
    default: {
      ...actual,
      allowRTL: (isAllowed: boolean) => {
        mockCalls.push(`allowRTL ${String(isAllowed)}`);
        actual.allowRTL(isAllowed);
      },
      forceRTL: (isForced: boolean) => {
        mockCalls.push(`forceRTL ${String(isForced)}`);
        actual.forceRTL(isForced);
      },
    },
  };
});

function recordRestart(): { readonly calls: string[]; readonly guard: DirectionGuard } {
  const calls = mockCalls;
  calls.length = 0;
  let pending: Direction | null = null;
  jest.mocked(reloadAppAsync).mockImplementation(async (reason) => {
    calls.push(`reload ${reason ?? ''}`);
    return Promise.resolve();
  });
  const guard: DirectionGuard = {
    readPending: () => pending,
    writePending: (direction) => {
      pending = direction;
      calls.push(`pending ${String(direction)}`);
    },
  };
  return { calls, guard };
}

describe('the direction restart on Android (spec N6)', () => {
  it('runs on the Android modules', () => {
    expect(Platform.OS).toBe('android');
    expect(readLayoutDirection()).toBe('ltr');
  });

  it('records the pending direction, then allows and forces RTL, then reloads once', async () => {
    const { calls, guard } = recordRestart();

    await restartForDirection('rtl', guard);

    expect(calls).toStrictEqual([
      'pending rtl',
      'allowRTL true',
      'forceRTL true',
      'reload layout direction -> rtl',
    ]);
  });

  it('turns English back to left-to-right on a Persian phone (allowRTL false as well)', async () => {
    const { calls, guard } = recordRestart();

    await restartForDirection('ltr', guard);

    expect(calls).toStrictEqual([
      'pending ltr',
      'allowRTL false',
      'forceRTL false',
      'reload layout direction -> ltr',
    ]);
  });

  it('gives up instead of reloading again when the reload left the layout unchanged', async () => {
    const { calls, guard } = recordRestart();
    await restartForDirection('rtl', guard);

    const plan = planDirection({
      language: 'fa',
      layout: readLayoutDirection(),
      pendingRestart: guard.readPending(),
    });

    expect(plan).toBe('give-up');
    expect(calls.filter((call) => call.startsWith('reload'))).toHaveLength(1);
  });

  it('formats Persian digits through the Intl polyfills on Android too', () => {
    expect(createNumberFormatter(localeTagFor('fa', 'automatic'))(1234)).toBe('۱٬۲۳۴');
    expect(createNumberFormatter(localeTagFor('ckb', 'automatic'))(56)).toBe('۵۶');
  });

  it('names the Persian faces by their file names, which Android resolves fonts by', () => {
    expect(scriptFontFor('fa', 'regular').fontFamily).toBe('Vazirmatn-Regular');
    expect(scriptFontFor('ckb', 'bold').fontFamily).toBe('Vazirmatn-Bold');
    expect(Object.values(FONT_FAMILIES)).toStrictEqual([
      'LilitaOne',
      'Rubik-Regular',
      'Rubik-Bold',
      'Vazirmatn-Regular',
      'Vazirmatn-Bold',
    ]);
  });
});
