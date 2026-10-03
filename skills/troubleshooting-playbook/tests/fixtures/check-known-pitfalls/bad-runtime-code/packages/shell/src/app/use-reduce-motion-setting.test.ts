// packages/shell/src/app/use-reduce-motion-setting.test.ts
import { act, renderHook } from '@testing-library/react-native';

import { systemA11yStore } from './system-a11y-store.ts';
import { useReduceMotionSetting } from './use-reduce-motion-setting.ts';

describe('useReduceMotionSetting', () => {
  afterEach(() => {
    systemA11yStore.setState({ isReduceMotionOn: false });
  });

  it('follows the phone switch', async () => {
    const { result } = await renderHook(() => useReduceMotionSetting());
    await act(() => systemA11yStore.setState({ isReduceMotionOn: true }));
    expect(result.current).toBe(true);
  });
});
