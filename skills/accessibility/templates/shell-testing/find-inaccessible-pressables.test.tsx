// packages/shell/src/testing/find-inaccessible-pressables.test.tsx
import { render, screen } from '@testing-library/react-native';
import { createElement } from 'react';

import { Button } from '@e07/shell/ui/button.tsx';
import { IconButton } from '@e07/shell/ui/icon-button.tsx';

import { findInaccessiblePressables } from './find-inaccessible-pressables.ts';
import { renderWithShell } from './render-with-shell.tsx';

type HostPressableProps = {
  readonly onPress: () => void;
  readonly testID: string;
  readonly accessibilityLabel: string;
};

describe('findInaccessiblePressables', () => {
  it('reports a pressable host element without a role', async () => {
    // A bare host element stands in for a hand-made pressable that forgot its role.
    await render(
      createElement<HostPressableProps>('RCTView', {
        onPress: jest.fn(),
        testID: 'zz.no-role',
        accessibilityLabel: 'Go',
      }),
    );
    expect(findInaccessiblePressables(screen.container)).toStrictEqual(['zz.no-role: no role']);
  });

  it('reports an icon button whose label is empty', async () => {
    await renderWithShell(
      <IconButton
        icon="gear"
        label=""
        onPress={jest.fn()}
        testID="zz.no-name"
        isReducedMotion={false}
      />,
    );
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([
      'zz.no-name: no accessible name',
    ]);
  });

  it('accepts the Shell buttons, named by their label', async () => {
    await renderWithShell(
      <Button label="Play" onPress={jest.fn()} testID="zz.named" isReducedMotion={false} />,
    );
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});
