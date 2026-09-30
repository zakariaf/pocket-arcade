// The helper's own test may call RNTL's render directly: it is the one place that builds the tree.
import { render, screen } from '@testing-library/react-native';

import { createShellWrapper } from './render-with-shell.tsx';

describe('createShellWrapper', () => {
  it('provides the stores to the tree', async () => {
    const { wrapper } = createShellWrapper();
    await render(<Probe />, { wrapper });
    expect(screen.getByText('ok')).toBeOnTheScreen();
  });
});
