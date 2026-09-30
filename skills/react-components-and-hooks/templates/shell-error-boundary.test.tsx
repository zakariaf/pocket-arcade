// packages/shell/src/app/shell-error-boundary.test.tsx
// no-shell-context: the boundary takes everything through props and reads no store, port or catalog.
import { act, render, screen } from '@testing-library/react-native';
import { View } from 'react-native';

import { ShellErrorBoundary } from './shell-error-boundary.tsx';

import type { ReactNode } from 'react';

let shouldThrow = true;

function Flaky(): ReactNode {
  if (shouldThrow) throw new Error('board exploded');
  return <View testID="game.board" />;
}

describe('ShellErrorBoundary', () => {
  beforeEach(() => {
    shouldThrow = true;
    // React logs caught render errors to console.error; keep the test output readable.
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('shows the fallback and logs the error once', async () => {
    const onError = jest.fn();
    await render(
      <ShellErrorBoundary onError={onError} renderFallback={() => <View testID="crash.card" />}>
        <Flaky />
      </ShellErrorBoundary>,
    );
    expect(screen.getByTestId('crash.card')).toBeOnTheScreen();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(Error);
  });

  it('renders the children again only after the fallback calls reset', async () => {
    let reset: () => void = () => undefined;
    await render(
      <ShellErrorBoundary
        onError={jest.fn()}
        renderFallback={(doReset) => {
          reset = doReset;
          return <View testID="crash.card" />;
        }}
      >
        <Flaky />
      </ShellErrorBoundary>,
    );
    shouldThrow = false;
    expect(screen.getByTestId('crash.card')).toBeOnTheScreen();
    await act(() => {
      reset();
    });
    expect(screen.getByTestId('game.board')).toBeOnTheScreen();
  });
});
