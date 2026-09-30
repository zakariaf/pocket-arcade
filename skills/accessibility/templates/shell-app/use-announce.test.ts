// packages/shell/src/app/use-announce.test.ts
// no-shell-context: the hook reads only the vanilla system-a11y store.
import { act, renderHook } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { systemA11yStore } from './system-a11y-store.ts';
import { useAnnounce } from './use-announce.ts';

describe('useAnnounce', () => {
  beforeEach(() => {
    systemA11yStore.setState({ isReduceMotionOn: false, isScreenReaderOn: false });
  });

  it('stays silent while VoiceOver is off', async () => {
    const speak = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const { result } = await renderHook(() => useAnnounce());
    result.current('Level won');
    expect(speak).not.toHaveBeenCalled();
  });

  it('speaks through VoiceOver once it is running', async () => {
    const speak = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const { result } = await renderHook(() => useAnnounce());
    await act(() => {
      systemA11yStore.setState({ isScreenReaderOn: true });
    });
    result.current('Level won');
    expect(speak).toHaveBeenCalledWith('Level won');
  });
});
