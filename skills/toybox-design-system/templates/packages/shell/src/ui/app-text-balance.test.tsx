// packages/shell/src/ui/app-text-balance.test.tsx
import { act, fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { AppText } from './app-text.tsx';

import type { TextStyle } from 'react-native';

describe('AppText balanced display text (the design .d: text-wrap balance)', () => {
  it('pads a two-line heading at its end until its lines are nearly equal', async () => {
    await renderWithShell(
      <AppText
        text="In short: no accounts, and the game itself collects no data."
        variant="heading"
        testID="x.label"
      />,
    );
    const label = screen.getByTestId('x.label');

    await fireEvent(label, 'layout', { nativeEvent: { layout: { width: 316, height: 60 } } });
    await fireEvent(label, 'textLayout', {
      nativeEvent: { lines: [{ width: 305 }, { width: 56 }] },
    });

    expect(label).toHaveStyle({ paddingEnd: 68 });
  });

  it('balances when iOS sends the text layout and the layout in one batch (no stale closure)', async () => {
    await renderWithShell(
      <AppText
        text="In short: no accounts, and the game itself collects no data."
        variant="heading"
        testID="x.label"
      />,
    );
    const label = screen.getByTestId('x.label');
    const handlers = label.props as {
      onTextLayout: (event: unknown) => void;
      onLayout: (event: unknown) => void;
    };

    await act(() => {
      handlers.onTextLayout({ nativeEvent: { lines: [{ width: 305 }, { width: 56 }] } });
      handlers.onLayout({ nativeEvent: { layout: { width: 316, height: 60 } } });
    });

    expect(screen.getByTestId('x.label')).toHaveStyle({ paddingEnd: 68 });
  });

  it('leaves a key label greedy, as the design draws it without .d (spec S9)', async () => {
    // The hero key's label is the mockup's .btn .bl: Lilita One, but no text-wrap balance. In de
    // Chrome breaks "Heutige Challenge / spielen"; a balanced label broke "Heutige / Challenge
    // spielen" (E17 S9 parity).
    await renderWithShell(
      <AppText text="Heutige Challenge spielen" variant="heroKeyLabel" testID="x.key-label" />,
    );
    const label = screen.getByTestId('x.key-label');

    await fireEvent(label, 'layout', { nativeEvent: { layout: { width: 270, height: 56 } } });
    await fireEvent(label, 'textLayout', {
      nativeEvent: { lines: [{ width: 190 }, { width: 70 }] },
    });

    expect(StyleSheet.flatten(label.props['style'] as TextStyle)?.paddingEnd).toBeUndefined();
  });

  it('leaves a stat value greedy, as the design draws its .sv without .d (spec S10)', async () => {
    // The S10 grid value is the mockup's .sv: Lilita One, no text-wrap balance. In de Chrome breaks
    // "2 Std. 14 / Min."; a balanced value broke "2 Std. / 14 Min." (E17 S10 parity).
    await renderWithShell(<AppText text="2 Std. 14 Min." variant="number" testID="x.value" />);
    const value = screen.getByTestId('x.value');

    await fireEvent(value, 'layout', { nativeEvent: { layout: { width: 150, height: 66 } } });
    await fireEvent(value, 'textLayout', {
      nativeEvent: { lines: [{ width: 107 }, { width: 50 }] },
    });

    expect(StyleSheet.flatten(value.props['style'] as TextStyle)?.paddingEnd).toBeUndefined();
  });

  it('keeps every word whole: a probe that splits one has failed (spec 8.11)', async () => {
    // At 200 % text the de S7 lose title needs two lines. A narrower probe kept two lines only by
    // breaking "Diesmal" inside it (iOS wraps a word wider than its line letter by letter), and the
    // search kept that width: "Diesm / al nicht". CSS balance never breaks a word.
    await renderWithShell(
      <AppText text="Diesmal nicht" variant="display" align="center" testID="result.title" />,
    );
    const title = (): ReturnType<typeof screen.getByTestId> => screen.getByTestId('result.title');
    const lines = (...parts: readonly (readonly [string, number])[]): unknown => ({
      nativeEvent: { lines: parts.map(([text, width]) => ({ text, width })) },
    });
    await fireEvent(title(), 'layout', { nativeEvent: { layout: { width: 380, height: 180 } } });
    await fireEvent(title(), 'textLayout', lines(['Diesmal ', 270], ['nicht', 170]));
    // The first probe: floor(min((220 + 380) / 2, 269.5)) = 269, a 111 pt pad split on both sides.
    expect(title()).toHaveStyle({ paddingHorizontal: 111 / 2 });

    await fireEvent(title(), 'textLayout', lines(['Diesm', 190], ['al nicht', 260]));
    await fireEvent(title(), 'textLayout', lines(['Diesmal ', 270], ['nicht', 170]));

    expect(
      StyleSheet.flatten(title().props['style'] as TextStyle)?.paddingHorizontal,
    ).toBeUndefined();
  });

  it('leaves body text greedy', async () => {
    await renderWithShell(<AppText text="Body text" testID="x.body" />);
    const body = screen.getByTestId('x.body');

    await fireEvent(body, 'layout', { nativeEvent: { layout: { width: 316, height: 60 } } });

    expect(body).not.toHaveStyle({ paddingEnd: 68 });
  });
});
