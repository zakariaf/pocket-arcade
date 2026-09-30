// packages/shell/src/app/use-reduce-motion-setting.test.ts
import { act, renderHook } from '@testing-library/react-native';

import { createShellWrapper } from '@e07/shell/testing/render-with-shell.tsx';

import { systemA11yStore } from './system-a11y-store.ts';
import { resolveReduceMotion, useReduceMotionSetting } from './use-reduce-motion-setting.ts';

import type { SaveSettings } from '@e07/shell/services/save/schema/save-doc.ts';

async function reduceMotionSetting(preference: SaveSettings['reduceMotion']) {
  const shell = createShellWrapper({ settings: { reduceMotion: preference } });
  return renderHook(() => useReduceMotionSetting(), { wrapper: shell.wrapper });
}

describe('resolveReduceMotion', () => {
  it('follows the phone while the setting is System', () => {
    expect(resolveReduceMotion('system', true)).toBe(true);
    expect(resolveReduceMotion('system', false)).toBe(false);
  });

  it('lets an explicit choice win over the phone', () => {
    expect(resolveReduceMotion('off', true)).toBe(false);
    expect(resolveReduceMotion('on', false)).toBe(true);
  });
});

describe('useReduceMotionSetting', () => {
  afterEach(() => {
    systemA11yStore.setState({ isReduceMotionOn: false });
  });

  it('gives the saved choice, or the phone while the setting is System', async () => {
    expect((await reduceMotionSetting('off')).result.current).toBe(false);
    expect((await reduceMotionSetting('on')).result.current).toBe(true);
    const { result } = await reduceMotionSetting('system');
    expect(result.current).toBe(false);
    await act(() => {
      systemA11yStore.setState({ isReduceMotionOn: true });
    });
    expect(result.current).toBe(true);
  });
});
