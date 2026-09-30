// packages/shell/src/app/press-feedback-context.test.tsx
// no-shell-context: the hook reads only its own context; one case renders it without the provider on purpose.
import { renderHook } from '@testing-library/react-native';

import { PressFeedbackProvider, usePressFeedback } from './press-feedback-context.tsx';

import type { ReactNode } from 'react';

describe('usePressFeedback', () => {
  it('is silent outside the provider', async () => {
    const { result } = await renderHook(() => usePressFeedback());
    expect(() => {
      result.current();
    }).not.toThrow();
  });

  it("runs the provider's feedback on a press", async () => {
    const onPress = jest.fn();
    const wrapper = (props: { readonly children: ReactNode }) => (
      <PressFeedbackProvider onPress={onPress}>{props.children}</PressFeedbackProvider>
    );
    const { result } = await renderHook(() => usePressFeedback(), { wrapper });
    result.current();
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
