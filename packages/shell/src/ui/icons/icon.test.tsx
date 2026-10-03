// packages/shell/src/ui/icons/icon.test.tsx
import { screen } from '@testing-library/react-native';
import { View } from 'react-native';

import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { DIRECTIONAL_ICONS, ICON_PATHS } from './icon-paths.ts';
import { Icon } from './icon.tsx';

describe('Icon', () => {
  it('mirrors directional icons in right-to-left layouts', async () => {
    await renderWithShell(
      <View testID="test.icon-row">
        <Icon name="back" color="#1D1B3A" />
      </View>,
      { language: 'fa' },
    );

    expect(screen.getByTestId('test.icon-row').children[0]).toHaveStyle({
      transform: [{ scaleX: -1 }],
    });
  });

  it('keeps play unmirrored in right-to-left layouts', async () => {
    await renderWithShell(
      <View testID="test.icon-row">
        <Icon name="play" color="#1D1B3A" size={26} />
      </View>,
      { language: 'fa' },
    );

    expect(screen.getByTestId('test.icon-row').children[0]).not.toHaveStyle({
      transform: [{ scaleX: -1 }],
    });
    expect(screen.getByTestId('test.icon-row').children[0]).toHaveStyle({ width: 26, height: 26 });
  });

  it('holds the 41 Toybox glyphs, the three rating-star layers and four directional icons', () => {
    expect(Object.keys(ICON_PATHS)).toHaveLength(44);
    expect([...DIRECTIONAL_ICONS]).toStrictEqual(['back', 'chevron', 'forward', 'undo']);
  });
});
