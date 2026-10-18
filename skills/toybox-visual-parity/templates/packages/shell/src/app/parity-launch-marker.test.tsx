// packages/shell/src/app/parity-launch-marker.test.tsx
// no-shell-context: the marker reads only its own context.
import { render, screen } from '@testing-library/react-native';

import {
  ParityLaunchContext,
  ParityLaunchMarker,
  parityLaunchTestID,
} from './parity-launch-marker.tsx';

describe('ParityLaunchMarker', () => {
  it('draws nothing outside a parity capture', async () => {
    await render(<ParityLaunchMarker />);

    expect(screen.toJSON()).toBeNull();
  });

  it("names this launch's nonce in its testID and label", async () => {
    await render(
      <ParityLaunchContext value="3f9a0c1d2e4b">
        <ParityLaunchMarker />
      </ParityLaunchContext>,
    );

    expect(screen.getByTestId('parity.launch.3f9a0c1d2e4b')).toHaveProp(
      'accessibilityLabel',
      '3f9a0c1d2e4b',
    );
  });

  it("sits clear of the system bars, which hide what lies under them from Android's accessibility tree", async () => {
    await render(
      <ParityLaunchContext value="3f9a0c1d2e4b">
        <ParityLaunchMarker />
      </ParityLaunchContext>,
    );

    // Android marks a node under the status bar's window (the top 44 dp, cutout included) or the
    // navigation bar's not visible to the user, and Maestro's dump drops it.
    expect(screen.getByTestId('parity.launch.3f9a0c1d2e4b')).toHaveStyle({
      position: 'absolute',
      top: '50%',
      start: '50%',
    });
  });

  it('builds the testID the capture script looks for', () => {
    expect(parityLaunchTestID('a1b2c3')).toBe('parity.launch.a1b2c3');
  });
});
