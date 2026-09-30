// packages/shell/src/app/use-reduce-motion.test.ts
import { renderHook } from '@testing-library/react-native';

import { createShellWrapper } from '@e07/shell/testing/render-with-shell.tsx';

import { useReduceMotionSetting } from './use-reduce-motion-setting.ts';
import { useReduceMotion } from './use-reduce-motion.ts';

import type { SaveSettings } from '@e07/shell/services/save/schema/save-doc.ts';

/** TEST_ONLY as a parity launch sees it (animations=off) or a normal launch (null session). */
const mockParity = { isFrozen: false };
jest.mock('./test-only.ts', () => ({
  TEST_ONLY: { isParityMotionFrozen: () => mockParity.isFrozen },
}));

async function bothHooks(preference: SaveSettings['reduceMotion']) {
  const shell = createShellWrapper({ settings: { reduceMotion: preference } });
  const { result } = await renderHook(
    () => ({ motion: useReduceMotion(), row: useReduceMotionSetting() }),
    { wrapper: shell.wrapper },
  );
  return result.current;
}

describe('useReduceMotion', () => {
  afterEach(() => {
    mockParity.isFrozen = false;
  });

  it('follows the saved setting on a normal launch', async () => {
    await expect(bothHooks('off')).resolves.toStrictEqual({ motion: false, row: false });
    await expect(bothHooks('on')).resolves.toStrictEqual({ motion: true, row: true });
  });

  it('holds every loop and entrance still during a parity capture, leaving the row as saved', async () => {
    mockParity.isFrozen = true;
    await expect(bothHooks('off')).resolves.toStrictEqual({ motion: true, row: false });
    await expect(bothHooks('system')).resolves.toStrictEqual({ motion: true, row: false });
  });
});
