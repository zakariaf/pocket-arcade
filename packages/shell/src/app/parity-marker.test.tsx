// packages/shell/src/app/parity-marker.test.tsx
// no-shell-context: the marker reads no context.
import { render, screen } from '@testing-library/react-native';

import { ParityMarker } from './parity-marker.tsx';

describe('ParityMarker (the launch and scroll markers share it)', () => {
  it('draws one invisible accessible 1 x 1 pt element in the middle of its parent', async () => {
    await render(<ParityMarker testID="parity.scroll.12.50" label="12.50" />);

    // Clear of the system bars, as both markers must be for Maestro's Android dump.
    const marker = screen.getByTestId('parity.scroll.12.50');
    expect(marker).toHaveProp('accessibilityLabel', '12.50');
    expect(marker).toHaveProp('accessible', true);
    expect(marker).toHaveStyle({
      position: 'absolute',
      top: '50%',
      start: '50%',
      width: 1,
      height: 1,
    });
  });
});
