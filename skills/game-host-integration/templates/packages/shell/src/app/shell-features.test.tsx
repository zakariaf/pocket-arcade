// packages/shell/src/app/shell-features.test.tsx
import { fireEvent, screen } from '@testing-library/react-native';

import { useGameHost } from '@e07/shell/game-host/game-host-context.tsx';
import { createFakeAudio } from '@e07/shell/services/audio/fake-audio.ts';
import { createFakeHaptics } from '@e07/shell/services/haptics/fake-haptics.ts';
import { createTestAdapters } from '@e07/shell/testing/create-test-adapters.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';
import { TALLY_GAME } from '@e07/shell/testing/tally-game.ts';
import { AppText } from '@e07/shell/ui/app-text.tsx';
import { Button } from '@e07/shell/ui/button.tsx';

import { createShellParts } from './create-shell-parts.ts';
import { usePremiumScreenDeps } from './premium-screen-deps-context.tsx';
import { ShellFeatures } from './shell-features.tsx';

import type { ReactNode } from 'react';

/** Stands in for the navigator: reads what ShellFeatures provides to every screen. */
function MockProbeNavigator(): ReactNode {
  const host = useGameHost();
  const premium = usePremiumScreenDeps();
  const text = `${host.id} ${premium.gameName.id} ${premium.service.productId}`;
  return (
    <>
      <AppText testID="probe.text" text={text} />
      <Button testID="probe.button" label="Probe" onPress={noop} isReducedMotion />
    </>
  );
}

function noop(): void {
  // The Shell button plays the tap feedback itself.
}
jest.mock('./shell-navigator.tsx', () => ({ ShellNavigator: MockProbeNavigator }));
jest.mock(
  'expo-constants',
  () =>
    jest.requireActual<Record<string, unknown>>('@e07/shell/testing/test-game-extra.ts')[
      'TEST_EXPO_CONSTANTS'
    ],
);

describe('ShellFeatures', () => {
  it('provides the game host, the S12 dependencies and the tap sound to every screen', async () => {
    const parts = createShellParts(
      { game: TALLY_GAME, language: 'en', directionPlan: 'keep' },
      createTestAdapters(),
    );
    const audio = createFakeAudio();
    const haptics = createFakeHaptics();
    const services = { ...parts.services, audio, haptics };
    await renderWithShell(
      <ShellFeatures
        host={parts.host}
        services={services}
        premiumDeps={parts.premiumDeps}
        debug={parts.debug}
        isConsentMomentHeld={false}
        initialState={undefined}
        loadOutcome={null}
      />,
      { services },
    );
    expect(screen.getByTestId('probe.text')).toHaveTextContent(
      'tally tally.name com.example.tally.premium',
    );
    await fireEvent.press(screen.getByTestId('probe.button'));
    expect(audio.calls).toStrictEqual([{ kind: 'play', soundId: 'ui.tap', delayMs: 0 }]);
    // A button tap has a sound and no pulse (ui-feedback.ts).
    expect(haptics.played).toStrictEqual([]);
  });
});
