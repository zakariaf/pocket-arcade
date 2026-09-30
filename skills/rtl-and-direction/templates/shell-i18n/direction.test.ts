// packages/shell/src/i18n/direction.test.ts
import { reloadAppAsync } from 'expo';

import { readLayoutDirection, restartForDirection } from './direction.ts';

import type { DirectionGuard } from './direction-guard.ts';
import type { Direction } from './languages.ts';

jest.mock('expo', () => ({ reloadAppAsync: jest.fn(() => Promise.resolve()) }));

describe('direction', () => {
  it('reads the layout direction once per JS run (Jest reports LTR)', () => {
    expect(readLayoutDirection()).toBe('ltr');
  });

  it('records the pending direction before it forces the layout and reloads once', async () => {
    const writes: (Direction | null)[] = [];
    const guard: DirectionGuard = {
      readPending: () => null,
      writePending: (direction) => {
        writes.push(direction);
      },
    };
    await restartForDirection('rtl', guard);
    expect(writes).toStrictEqual(['rtl']);
    expect(reloadAppAsync).toHaveBeenCalledTimes(1);
    expect(reloadAppAsync).toHaveBeenCalledWith('layout direction -> rtl');
  });
});
