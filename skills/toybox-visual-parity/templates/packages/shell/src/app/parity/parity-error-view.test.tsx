// packages/shell/src/app/parity/parity-error-view.test.tsx
// no-shell-context: the error view is the whole app root of a bad launch, so no Shell provider exists around it.
import { render, screen } from '@testing-library/react-native';
import { createElement } from 'react';

import { createParityErrorRoot } from './parity-error-view.tsx';

describe('createParityErrorRoot', () => {
  it('shows only the error, as the label of the parity.error root', async () => {
    await render(createElement(createParityErrorRoot('unknown parameter "zoom"')));

    expect(screen.getByTestId('parity.error')).toHaveProp(
      'accessibilityLabel',
      'unknown parameter "zoom"',
    );
    expect(screen.getByLabelText('unknown parameter "zoom"')).toBeOnTheScreen();
  });
});
