// packages/shell/src/ui/app-text-balance.test.tsx
import { act, fireEvent, screen } from '@testing-library/react-native';

import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { AppText } from './app-text.tsx';

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

  it('leaves body text greedy', async () => {
    await renderWithShell(<AppText text="Body text" testID="x.body" />);
    const body = screen.getByTestId('x.body');

    await fireEvent(body, 'layout', { nativeEvent: { layout: { width: 316, height: 60 } } });

    expect(body).not.toHaveStyle({ paddingEnd: 68 });
  });
});
