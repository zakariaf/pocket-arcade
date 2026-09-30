// packages/shell/src/ui/streak-card.test.tsx
import { screen, userEvent } from '@testing-library/react-native';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { StreakCard } from './streak-card.tsx';

describe('StreakCard', () => {
  it('shows the streak as a header and a value, with one named action', async () => {
    const onAction = jest.fn();
    const user = userEvent.setup();
    await renderWithShell(
      <StreakCard
        title="Current streak"
        value="5 days"
        actionLabel="Play"
        onAction={onAction}
        isReducedMotion={false}
        testID="daily.streak-card"
      />,
    );

    expect(screen.getByRole('header', { name: 'Current streak' })).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Play' }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});
