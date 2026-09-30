// Example (shape only, never copied into the app): the test of labelled-value.tsx.
import { screen } from '@testing-library/react-native';

import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { LabelledValue } from './labelled-value.tsx';

describe('LabelledValue', () => {
  it('derives the part testIDs from its one testID', async () => {
    await renderWithShell(
      <LabelledValue label="Wins" value="36" testID="stats.overview-card.wins" />,
    );
    expect(screen.getByTestId('stats.overview-card.wins.value')).toHaveTextContent('36');
    expect(screen.getByTestId('stats.overview-card.wins.label')).toHaveTextContent('Wins');
  });

  it('renders the accessory slot after the value', async () => {
    await renderWithShell(
      <LabelledValue
        label="Best"
        value="4,210"
        testID="stats.best"
        accessory={<LabelledValue label="New" value="!" testID="stats.best.badge" />}
      />,
    );
    expect(screen.getByTestId('stats.best.badge')).toBeOnTheScreen();
  });
});
