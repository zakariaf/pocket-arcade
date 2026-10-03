// packages/shell/src/ui/empty-stats-picture.test.tsx
import { screen } from '@testing-library/react-native';

import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { EmptyStatsPicture } from './empty-stats-picture.tsx';

describe('EmptyStatsPicture', () => {
  it('keeps the 190 x 150 proportions and stays hidden from VoiceOver', async () => {
    await renderWithShell(<EmptyStatsPicture width={95} testID="stats.empty-picture" />);

    const picture = screen.getByTestId('stats.empty-picture', { includeHiddenElements: true });
    expect(picture).toHaveStyle({ width: 95, height: 75 });
    expect(screen.queryByTestId('stats.empty-picture')).not.toBeOnTheScreen();
  });
});
