// packages/shell/src/screens/debug/font-test-view.test.tsx
import { screen } from '@testing-library/react-native';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { FONT_TEST_SAMPLES, fontTestRowsOf } from './font-test-samples.ts';
import { FontTestView } from './font-test-view.tsx';

describe('FontTestView', () => {
  it('names each type variant and draws the four samples in it', async () => {
    const rows = fontTestRowsOf(['levelNumber', 'body'], FONT_TEST_SAMPLES);
    await renderWithShell(<FontTestView model={{ rows }} />);

    expect(screen.getByTestId('font-test.screen')).toBeOnTheScreen();
    expect(screen.getByText('levelNumber')).toBeOnTheScreen();
    for (const sample of FONT_TEST_SAMPLES)
      expect(screen.getAllByText(sample.text)).toHaveLength(2);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});
