// packages/shell/src/app/shell-error-boundary.test.tsx
// no-shell-context: the boundary takes everything through props and reads no store, port or catalog.
import { render, screen } from '@testing-library/react-native';
import { View } from 'react-native';

import { ShellErrorBoundary } from './shell-error-boundary.tsx';

function Crash(): never {
  throw new Error('board exploded');
}

describe('ShellErrorBoundary', () => {
  it('shows the fallback instead of the crashed child', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await render(
      <ShellErrorBoundary onError={jest.fn()} renderFallback={() => <View testID="crash.card" />}>
        <Crash />
      </ShellErrorBoundary>,
    );

    expect(screen.getByTestId('crash.card')).toBeOnTheScreen();
  });
});
