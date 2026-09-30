// packages/shell/src/app/system-a11y-store.test.ts
import { AccessibilityInfo } from 'react-native';

import { systemA11yStore, watchSystemA11y } from './system-a11y-store.ts';

type Listener = (isOn: boolean) => void;

/** Replaces the two OS listeners and the two first reads; returns the captured listeners. */
function fakeOs(first: { motion: Promise<boolean>; reader: Promise<boolean> }): {
  readonly listeners: Map<string, Listener>;
  readonly removed: string[];
} {
  const listeners = new Map<string, Listener>();
  const removed: string[] = [];
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((name, listener) => {
    listeners.set(name, listener);
    return { remove: () => removed.push(name) };
  });
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(first.motion);
  jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockReturnValue(first.reader);
  return { listeners, removed };
}

describe('watchSystemA11y', () => {
  beforeEach(() => {
    systemA11yStore.setState({ isReduceMotionOn: false, isScreenReaderOn: false });
  });

  it('reads both OS switches once, then follows their changes', async () => {
    const os = fakeOs({ motion: Promise.resolve(true), reader: Promise.resolve(false) });
    const stop = watchSystemA11y(jest.fn());
    await Promise.resolve();
    expect(systemA11yStore.getState()).toStrictEqual({
      isReduceMotionOn: true,
      isScreenReaderOn: false,
    });

    os.listeners.get('screenReaderChanged')?.(true);
    os.listeners.get('reduceMotionChanged')?.(false);
    expect(systemA11yStore.getState()).toStrictEqual({
      isReduceMotionOn: false,
      isScreenReaderOn: true,
    });

    stop();
    expect(os.removed).toStrictEqual(['reduceMotionChanged', 'screenReaderChanged']);
  });

  it('reports a failed first read and keeps the defaults', async () => {
    const failure = new Error('no accessibility service');
    fakeOs({ motion: Promise.reject(failure), reader: Promise.resolve(false) });
    const onError = jest.fn();
    watchSystemA11y(onError);
    await new Promise<void>((resolve) => {
      setImmediate(() => {
        resolve();
      });
    });
    expect(onError).toHaveBeenCalledWith(failure);
    expect(systemA11yStore.getState().isReduceMotionOn).toBe(false);
  });
});
