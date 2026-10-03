// packages/shell/src/ui/use-chrome-baseline.test.tsx
import { renderHook } from '@testing-library/react-native';
import { PixelRatio } from 'react-native';

import { createShellWrapper } from '@e07/shell/testing/render-with-shell.tsx';

import { useChromeBaseline } from './use-chrome-baseline.ts';

import type { Language } from '@e07/shell/i18n/languages.ts';
import type { TypeVariant } from '@e07/shell/theme/type-styles.ts';

async function baselineIn(language: Language, variant: TypeVariant): Promise<number> {
  const { wrapper } = createShellWrapper({ language });
  const { result } = await renderHook(() => useChromeBaseline(variant), { wrapper });
  return result.current;
}

describe('useChromeBaseline', () => {
  beforeEach(() => {
    jest.spyOn(PixelRatio, 'get').mockReturnValue(3);
  });

  it('measures the stat-list key baseline in Rubik (15 pt on a 59/3 pt line)', async () => {
    expect(await baselineIn('en', 'statListKey')).toBeCloseTo(14.83, 2);
  });

  it('measures the Persian value baseline in Vazirmatn Bold, overflow centred as Chrome does', async () => {
    // 22 pt on a 73/3 pt line: content 23 + 12 = 35, baseline (24.33 - 35) / 2 + 23.
    expect(await baselineIn('fa', 'statListValue')).toBeCloseTo(17.67, 2);
  });
});
