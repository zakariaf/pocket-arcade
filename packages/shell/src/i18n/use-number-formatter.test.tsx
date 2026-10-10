// packages/shell/src/i18n/use-number-formatter.test.tsx
import { renderHook } from '@testing-library/react-native';

import { createShellWrapper } from '@e07/shell/testing/render-with-shell.tsx';

import { useNumberFormatter, usePercentFormatter } from './use-number-formatter.ts';

import type { RenderWithShellOptions } from '@e07/shell/testing/render-with-shell.tsx';

async function formattersFor(options: RenderWithShellOptions) {
  const { wrapper } = createShellWrapper(options);
  const { result } = await renderHook(
    () => ({ number: useNumberFormatter(), percent: usePercentFormatter() }),
    { wrapper },
  );
  return result.current;
}

describe('the number formatter hooks', () => {
  it('writes numbers in the digits the language and the Numbers setting pick (spec 7.3)', async () => {
    const automatic = await formattersFor({ language: 'fa', settings: { digits: 'automatic' } });
    const latin = await formattersFor({ language: 'fa', settings: { digits: 'latin' } });

    expect([automatic.number(12), automatic.percent(0.62)]).toStrictEqual(['۱۲', '۶۲٪']);
    expect([latin.number(12), latin.percent(0.62)]).toStrictEqual(['12', '62%']);
  });

  it('hands out the one formatter kept for a locale tag', async () => {
    const first = await formattersFor({ language: 'de' });
    const second = await formattersFor({ language: 'de' });

    expect(second.number).toBe(first.number);
    expect(second.percent).toBe(first.percent);
  });
});
