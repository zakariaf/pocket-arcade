// packages/shell/src/ui/ad-slot.test.tsx
// no-shell-context: props
import { render, screen } from '@testing-library/react-native';

import { AdSlot } from './ad-slot.tsx';

describe('AdSlot', () => {
  it('renders nothing when the policy forbids a banner', async () => {
    await render(<AdSlot isAllowed={false} />);

    expect(screen.queryByTestId('home.banner-ad')).not.toBeOnTheScreen();
  });
});
