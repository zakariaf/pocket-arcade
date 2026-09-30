// packages/shell/src/navigation/font-test-route.test.tsx
import { screen } from '@testing-library/react-native';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { FontTestRoute } from './font-test-route.tsx';

describe('FontTestRoute', () => {
  it('draws the font test page through TEST_ONLY in a test build', async () => {
    await renderWithShell(<FontTestRoute />);
    expect(screen.getByTestId('font-test.screen')).toBeOnTheScreen();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});
