// packages/shell/src/screens/debug/use-font-test-model.test.tsx
// no-shell-context: the model reads no store, port or catalog; it lists type styles and samples.
import { renderHook } from '@testing-library/react-native';

import { FONT_TEST_VARIANTS } from './font-test-samples.ts';
import { useFontTestModel } from './use-font-test-model.ts';

describe('useFontTestModel', () => {
  it('gives one row per type variant with the four language samples', async () => {
    const { result } = await renderHook(() => useFontTestModel());
    expect(result.current.rows.map((row) => row.variant)).toStrictEqual(FONT_TEST_VARIANTS);
    expect(result.current.rows[0]?.samples.map((sample) => sample.language)).toStrictEqual([
      'en',
      'de',
      'fa',
      'ckb',
    ]);
  });
});
