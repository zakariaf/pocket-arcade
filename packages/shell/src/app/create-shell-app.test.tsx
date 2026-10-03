// packages/shell/src/app/create-shell-app.test.tsx
// no-shell-context: createShellApp builds the Shell's providers itself; ShellApp is replaced by a probe.
import { render, screen } from '@testing-library/react-native';
import { createElement } from 'react';
import { View } from 'react-native';

import { TALLY_GAME } from '@e07/shell/testing/tally-game.ts';

import { createShellApp } from './create-shell-app.tsx';
import { createDeviceAdapters } from './device-adapters.ts';

import type { ShellAppProps } from './shell-app.tsx';
import type { ComponentType, ReactNode } from 'react';

// The phone's adapters open native modules; the in-memory set stands in for them here.
jest.mock('./device-adapters.ts', () => ({
  createDeviceAdapters: jest.fn(() =>
    jest
      .requireActual<{ createTestAdapters: () => unknown }>(
        '@e07/shell/testing/create-test-adapters.ts',
      )
      .createTestAdapters(),
  ),
}));

/** Stands in for ShellApp: names the game and the save outcome of the parts it was given. */
function MockProbeApp({ parts }: ShellAppProps): ReactNode {
  const label = `${parts.host.id} ${parts.hydrated.outcome.kind}`;
  return <View testID="probe.parts" accessibilityLabel={label} />;
}
jest.mock('./shell-app.tsx', () => ({ ShellApp: MockProbeApp }));

describe('createShellApp', () => {
  it('builds the parts once from the device adapters and renders ShellApp with them', async () => {
    const root = createShellApp({ game: TALLY_GAME, language: 'en', directionPlan: 'keep' });
    expect(createDeviceAdapters).toHaveBeenCalledTimes(1);
    await render(createElement(root));
    await render(createElement(root));
    expect(screen.getByTestId('probe.parts')).toHaveProp('accessibilityLabel', 'tally fresh');
    expect(createDeviceAdapters).toHaveBeenCalledTimes(1);
  });

  it('lets a test-build launch wrap the root in its own contexts', async () => {
    function MockFrame({ children }: { readonly children: ReactNode }): ReactNode {
      return <View testID="probe.frame">{children}</View>;
    }
    const launch = {
      wrapRoot: (root: ComponentType): ComponentType =>
        function MockWrapped(): ReactNode {
          return <MockFrame>{createElement(root)}</MockFrame>;
        },
    };
    const root = createShellApp({
      game: TALLY_GAME,
      language: 'en',
      directionPlan: 'keep',
      launch,
    });
    await render(createElement(root));
    expect(screen.getByTestId('probe.frame')).toContainElement(screen.getByTestId('probe.parts'));
  });
});
