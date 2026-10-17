// packages/shell/src/app/parity/parity-scroll-marker.test.tsx
// no-shell-context: the marker reads nothing from the Shell.
import { render, screen } from '@testing-library/react-native';

import { ParityScrollMarker, parityScrollTestID } from './parity-scroll-marker.tsx';

describe('ParityScrollMarker', () => {
  it('names the offset the body reached in its testID and label, to the hundredth of a point', async () => {
    await render(<ParityScrollMarker y={107.33333} />);

    expect(screen.getByTestId('parity.scroll.107.33')).toHaveProp('accessibilityLabel', '107.33');
  });

  it("sits clear of the system bars, which hide what lies under them from Android's accessibility tree", async () => {
    await render(<ParityScrollMarker y={743} />);

    expect(screen.getByTestId('parity.scroll.743.00')).toHaveStyle({
      position: 'absolute',
      top: '50%',
      start: '50%',
      width: 1,
      height: 1,
    });
  });

  it.each([
    [0, 'parity.scroll.0.00'],
    [-0.004, 'parity.scroll.0.00'],
    [1170, 'parity.scroll.1170.00'],
    [740.806, 'parity.scroll.740.81'],
    [-12.5, 'parity.scroll.n12.50'],
  ])('writes the offset %p as the testID %s the capture script reads', (y, testID) => {
    expect(parityScrollTestID(y)).toBe(testID);
  });
});
