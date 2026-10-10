// packages/shell/src/screens/home/use-play-run.test.tsx
import { renderHook } from '@testing-library/react-native';

import { createHostWrapper } from '@e07/shell/testing/create-host-wrapper.tsx';

import { isSameRun, usePlayRun } from './use-play-run.ts';

import type { RunRef } from '@e07/shell/services/save/schema/save-doc.ts';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

const LEVEL_3: RunRef = { kind: 'level', level: 3 };
const TODAY: RunRef = { kind: 'daily', date: '2026-09-26' };

describe('isSameRun', () => {
  it.each<[RunRef, RunRef, boolean]>([
    [LEVEL_3, { kind: 'level', level: 3 }, true],
    [LEVEL_3, { kind: 'level', level: 4 }, false],
    [TODAY, { kind: 'daily', date: '2026-09-26' }, true],
    [TODAY, { kind: 'daily', date: '2026-09-25' }, false],
    [{ kind: 'endless' }, { kind: 'endless' }, true],
    [LEVEL_3, TODAY, false],
    [{ kind: 'endless' }, { kind: 'tutorial' }, false],
  ])('compares the saved run %j with the asked run %j: %s', (saved, wanted, isSame) => {
    expect(isSameRun(saved, wanted)).toBe(isSame);
  });
});

describe('usePlayRun', () => {
  it('resumes the saved run when a key asks for it, and starts any other run new (N10)', async () => {
    mockNavigate.mockClear();
    const shell = createHostWrapper();
    shell.host.openSession({ start: 'new', ref: LEVEL_3 });
    const { result } = await renderHook(() => usePlayRun(), { wrapper: shell.wrapper });

    result.current(LEVEL_3);
    result.current(TODAY);

    expect(mockNavigate.mock.calls).toStrictEqual([
      ['Game', { start: 'resume' }],
      ['Game', { start: 'new', ref: TODAY }],
    ]);
  });
});
