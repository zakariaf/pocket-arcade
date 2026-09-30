// packages/shell/src/ui/hazard-strip.test.tsx
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { HazardStrip } from './hazard-strip.tsx';

describe('HazardStrip', () => {
  it('draws its stripes once it knows its width', async () => {
    await renderWithShell(<HazardStrip testID="debug.hazard-strip" />);
    const strip = screen.getByTestId('debug.hazard-strip', { includeHiddenElements: true });
    expect(strip).toHaveStyle({ height: 20 });
    expect(strip.children).toHaveLength(0);

    await fireEvent(strip, 'layout', { nativeEvent: { layout: { width: 390, height: 20 } } });

    expect(strip.children).toHaveLength(1);
  });
});
