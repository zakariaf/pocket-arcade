// packages/shell/src/app/motion-config.test.tsx
import { act } from '@testing-library/react-native';
import { ReducedMotionConfig, ReduceMotion } from 'react-native-reanimated';

import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { MotionConfig } from './motion-config.tsx';

jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual<Record<string, unknown>>('react-native-reanimated'),
  ReducedMotionConfig: jest.fn(() => null),
}));

describe('MotionConfig', () => {
  it("sets Reanimated's global reduce-motion flag from the Shell setting", async () => {
    const config = jest.mocked(ReducedMotionConfig);
    const { stores } = await renderWithShell(<MotionConfig />, {
      settings: { reduceMotion: 'on' },
    });
    expect(config.mock.calls.at(-1)?.[0]).toStrictEqual({ mode: ReduceMotion.Always });

    await act(() => {
      stores.settings.getState().dispatch({ type: 'set-reduce-motion', reduceMotion: 'off' });
    });
    expect(config.mock.calls.at(-1)?.[0]).toStrictEqual({ mode: ReduceMotion.Never });
  });
});
