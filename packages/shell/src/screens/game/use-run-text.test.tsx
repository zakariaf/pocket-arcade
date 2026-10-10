// packages/shell/src/screens/game/use-run-text.test.tsx
import { renderHook } from '@testing-library/react-native';

import { createHostWrapper } from '@e07/shell/testing/create-host-wrapper.tsx';

import { useRunText } from './use-run-text.ts';

describe('useRunText', () => {
  it("gives the Shell's t(), numbers in the chosen digits and the game's own texts", async () => {
    const shell = createHostWrapper({ language: 'fa', settings: { digits: 'local' } });
    const { result } = await renderHook(() => useRunText(), { wrapper: shell.wrapper });
    expect(result.current.formatNumber(1840)).toBe('۱٬۸۴۰');
    expect(result.current.gameText({ id: 'tally.name', values: {} })).toBe('Tally');
    expect(result.current.t('common.score')).toBe('امتیاز');
  });

  it('keeps Western digits in English', async () => {
    const shell = createHostWrapper();
    const { result } = await renderHook(() => useRunText(), { wrapper: shell.wrapper });
    expect(result.current.formatNumber(1840)).toBe('1,840');
    expect(result.current.t('common.score')).toBe('Score');
  });
});
