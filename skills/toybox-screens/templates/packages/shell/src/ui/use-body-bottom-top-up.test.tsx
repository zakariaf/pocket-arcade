// packages/shell/src/ui/use-body-bottom-top-up.test.tsx
// no-shell-context: the hook reads only the safe-area insets.
import { renderHook } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { bodyBottomPaddingOf, useBodyBottomTopUp } from './use-body-bottom-top-up.ts';

import type { ReactNode } from 'react';

function topUpWith(
  insetBottom: number,
): Promise<{ readonly result: { readonly current: number } }> {
  const metrics = {
    frame: { x: 0, y: 0, width: 402, height: 874 },
    insets: { top: 44, left: 0, right: 0, bottom: insetBottom },
  };
  const wrapper = ({ children }: { readonly children: ReactNode }): ReactNode => (
    <SafeAreaProvider initialMetrics={metrics}>{children}</SafeAreaProvider>
  );
  return renderHook(() => useBodyBottomTopUp(), { wrapper });
}

describe('useBodyBottomTopUp (every Toybox page ends 34 pt above the screen edge)', () => {
  it('adds nothing above the iPhone 34 pt home indicator', async () => {
    expect((await topUpWith(34)).result.current).toBe(0);
  });

  it("adds 10 pt above Android's 24 dp gesture bar", async () => {
    expect((await topUpWith(24)).result.current).toBe(10);
  });

  it('keeps the full 34 pt on a phone without a bottom inset', async () => {
    expect((await topUpWith(0)).result.current).toBe(34);
  });
});

describe('bodyBottomPaddingOf', () => {
  it('keeps the larger of 34 pt and the inset under the home indicator', () => {
    expect(bodyBottomPaddingOf(true, 24)).toBe(34);
    expect(bodyBottomPaddingOf(true, 40)).toBe(40);
  });

  it('tops the inset up to 34 pt otherwise, never below 0', () => {
    expect(bodyBottomPaddingOf(false, 24)).toBe(10);
    expect(bodyBottomPaddingOf(false, 40)).toBe(0);
  });
});
