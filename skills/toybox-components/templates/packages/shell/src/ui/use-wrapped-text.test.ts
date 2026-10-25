// packages/shell/src/ui/use-wrapped-text.test.ts
// no-shell-context: the hook keeps only its own state and reads the window's metrics.
import { act, renderHook } from '@testing-library/react-native';

import { useWrappedText } from './use-wrapped-text.ts';

import type { useWindowDimensions } from 'react-native';

type WindowMetrics = ReturnType<typeof useWindowDimensions>;

const PHONE: WindowMetrics = { width: 402, height: 874, fontScale: 1, scale: 3 };
const mockWindow: { current: WindowMetrics } = { current: PHONE };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockWindow.current,
}));

type Props = { readonly text: string; readonly isSticky?: boolean };

async function renderWrapped(initial: Props) {
  return renderHook(
    ({ text, isSticky }: Props) => useWrappedText(text, { isSticky: isSticky === true }),
    { initialProps: initial },
  );
}

describe('useWrappedText', () => {
  beforeEach(() => {
    mockWindow.current = PHONE;
  });

  it('knows neither one line nor wrapped before the text is measured', async () => {
    const { result } = await renderWrapped({ text: 'Pen every sheep' });
    expect([result.current.isWrapped, result.current.isOneLine]).toStrictEqual([false, false]);
  });

  it('reports one line, then wrapped, as the measured line count changes', async () => {
    const { result } = await renderWrapped({ text: 'Pen every sheep' });
    await act(() => {
      result.current.onLineCount(1);
    });
    expect([result.current.isWrapped, result.current.isOneLine]).toStrictEqual([false, true]);
    await act(() => {
      result.current.onLineCount(2);
    });
    expect([result.current.isWrapped, result.current.isOneLine]).toStrictEqual([true, false]);
    await act(() => {
      result.current.onLineCount(1);
    });
    expect([result.current.isWrapped, result.current.isOneLine]).toStrictEqual([false, true]);
  });

  it('forgets a measure once the text changes, until the new text is measured', async () => {
    const { result, rerender } = await renderWrapped({ text: 'Pen every sheep' });
    await act(() => {
      result.current.onLineCount(3);
    });
    await rerender({ text: 'Mind the wolf' });
    expect([result.current.isWrapped, result.current.isOneLine]).toStrictEqual([false, false]);
  });

  it('stays wrapped when sticky, so a wider layout never flips it back for the same text', async () => {
    const { result, rerender } = await renderWrapped({
      text: 'Pack 2 · Rocky Hills',
      isSticky: true,
    });
    await act(() => {
      result.current.onLineCount(2);
    });
    await act(() => {
      result.current.onLineCount(1);
    });
    expect(result.current.isWrapped).toBe(true);
    await rerender({ text: 'Pack 3 · Wolf Country', isSticky: true });
    expect(result.current.isWrapped).toBe(false);
  });

  it('measures a sticky wrap again once the window is wider or the text smaller', async () => {
    const { result, rerender } = await renderWrapped({
      text: 'Pack 2 · Rocky Hills',
      isSticky: true,
    });
    await act(() => {
      result.current.onLineCount(2);
    });
    // Rotated to landscape: the row is wider, so the wrap is unknown until measured there.
    mockWindow.current = { ...PHONE, width: 874, height: 402 };
    await rerender({ text: 'Pack 2 · Rocky Hills', isSticky: true });
    await act(() => {
      result.current.onLineCount(1);
    });
    expect([result.current.isWrapped, result.current.isOneLine]).toStrictEqual([false, true]);
    // Back on the phone at a smaller text size: measured afresh, still sticky once it wraps.
    mockWindow.current = { ...PHONE, fontScale: 0.85 };
    await rerender({ text: 'Pack 2 · Rocky Hills', isSticky: true });
    await act(() => {
      result.current.onLineCount(2);
    });
    await act(() => {
      result.current.onLineCount(1);
    });
    expect(result.current.isWrapped).toBe(true);
  });
});
