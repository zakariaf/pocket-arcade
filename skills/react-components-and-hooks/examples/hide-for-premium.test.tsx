// Example (shape only, never copied into the app): the Profiler test of hide-for-premium.tsx.
import { act, screen } from '@testing-library/react-native';
import { Profiler } from 'react';
import { View } from 'react-native';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { HideForPremium } from './hide-for-premium.tsx';

const banner = <View testID="home.banner-ad" />;

describe('HideForPremium', () => {
  it('does not re-render when an unrelated store changes', async () => {
    const onRender = jest.fn();
    const { stores } = await renderWithShell(
      <Profiler id="hide-for-premium" onRender={onRender}>
        <HideForPremium>{banner}</HideForPremium>
      </Profiler>,
    );
    const rendersAfterMount = onRender.mock.calls.length;

    await act(() => {
      stores.settings.getState().dispatch({ type: 'set-sound', enabled: false, volume: 0 });
    });

    expect(onRender).toHaveBeenCalledTimes(rendersAfterMount);
  });

  it('removes its children as soon as Premium is granted', async () => {
    const { stores } = await renderWithShell(<HideForPremium>{banner}</HideForPremium>);
    expect(screen.getByTestId('home.banner-ad')).toBeOnTheScreen();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);

    await act(() => {
      stores.premium.getState().dispatch({ type: 'premium-granted' });
    });

    expect(screen.queryByTestId('home.banner-ad')).not.toBeOnTheScreen();
  });

  it('renders nothing when the save already holds Premium', async () => {
    await renderWithShell(<HideForPremium>{banner}</HideForPremium>, { isPremium: true });
    expect(screen.queryByTestId('home.banner-ad')).not.toBeOnTheScreen();
  });
});
