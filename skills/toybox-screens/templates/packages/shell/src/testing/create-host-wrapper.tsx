// packages/shell/src/testing/create-host-wrapper.tsx
// Model-hook tests: renderWithShell's providers plus the one GameHost the app provides, built by
// the real createGameHost from the tally test game (game-host-integration), with its texts in the
// game catalogs. A hook that reads useGameHost() and gameMessageText therefore renders as it does
// in the app; a run end is saved and then published to the section stores (updateAndPublish, as
// the composition root does), so S7's endless best and streak read the new values. The Shell clock
// is TEST_CLOCK (2026-09-26) unless the test passes services.clock. Pass `host` for what a test
// changes (hasMusic, credits, how-to-play pages).
import { GameHostProvider } from '@e07/shell/game-host/game-host-context.tsx';
import { createGameHost } from '@e07/shell/game-host/game-host.ts';
import { I18nProvider } from '@e07/shell/i18n/i18n-provider.tsx';
import { createFakeAudio } from '@e07/shell/services/audio/fake-audio.ts';
import { createFakeHaptics } from '@e07/shell/services/haptics/fake-haptics.ts';
import { updateAndPublish } from '@e07/shell/stores/update-and-publish.ts';
import { createTestSave, TEST_CLOCK } from '@e07/shell/testing/create-test-save.ts';
import { createShellWrapper } from '@e07/shell/testing/render-with-shell.tsx';
import { TALLY_GAME } from '@e07/shell/testing/tally-game.ts';

import type { GameHost, GameHostDeps } from '@e07/shell/game-host/game-host.ts';
import type { Language } from '@e07/shell/i18n/languages.ts';
import type { Catalog } from '@e07/shell/i18n/messages.ts';
import type { ClockPort } from '@e07/shell/services/clock/clock-port.ts';
import type { SaveService } from '@e07/shell/services/save/save-service.ts';
import type { SectionStores } from '@e07/shell/stores/update-and-publish.ts';
import type {
  RenderWithShellOptions,
  ShellWrapper,
} from '@e07/shell/testing/render-with-shell.tsx';
import type { ReactNode } from 'react';

export type HostWrapperOptions = RenderWithShellOptions & {
  /** Host fields the test changes; everything else comes from createGameHost(TALLY_GAME). */
  readonly host?: Partial<GameHost>;
};

export type HostWrapper = ShellWrapper & {
  readonly host: GameHost;
  /** The save the stores, the services and the host share. */
  readonly save: SaveService;
};

/**
 * Every message id the tally game names (its module ships empty texts), the same in every
 * language; create-host-wrapper.test.tsx reads the ids from the module and fails on a gap.
 */
export const TALLY_TEXTS: Catalog = {
  'tally.name': 'Tally',
  'tally.tagline': 'Count to the target.',
  'tally.pack.first': 'First steps',
  'tally.goal': 'Hit the target exactly.',
  'tally.how-to-play.step-1': 'Tap to add one.',
  'tally.how-to-play.step-2': 'Tap the other side to add two.',
  'tally.stats.adds': 'Adds',
  'tally.stats.biggest': 'Biggest add',
  'tally.win-title': 'Right on target!',
  'tally.lose.overshot': 'You went past the target.',
  'tally.continue.step-back': 'Step back one.',
  'tally.board.summary': 'The count is {count, number}.',
  'tally.tutorial.add-one': 'Tap the left column to add one.',
  'tally.tutorial.add-two': 'Now add two to hit the target.',
};

const TALLY_CATALOGS: Readonly<Record<Language, Catalog>> = {
  en: TALLY_TEXTS,
  de: TALLY_TEXTS,
  fa: TALLY_TEXTS,
  ckb: TALLY_TEXTS,
};

function failOnMissingMessage(error: Error): never {
  throw error;
}

function hostDepsFor(save: SaveService, clock: ClockPort, stores: SectionStores): GameHostDeps {
  return {
    save,
    clock,
    errorLog: { record: () => undefined, entries: () => [] },
    isContinueAllowed: true,
    createBoardHost: () => () => null,
    // Persist first, publish second, as the composition root writes every run end.
    writeRunEnd: (write) => {
      updateAndPublish(save, stores, write);
    },
    feedback: { audio: createFakeAudio(), haptics: createFakeHaptics() },
  };
}

/** The provider tree for renderHook(): the Shell's providers, the game catalogs, the game host. */
export function createHostWrapper(options: HostWrapperOptions = {}): HostWrapper {
  const clock = options.services?.clock ?? TEST_CLOCK;
  const save = options.services?.save ?? createTestSave(clock).save;
  const shell = createShellWrapper({ ...options, services: { clock, ...options.services, save } });
  const host: GameHost = {
    ...createGameHost(TALLY_GAME, hostDepsFor(save, clock, shell.stores)),
    ...options.host,
  };
  const language = options.language ?? 'en';
  const digits = shell.stores.settings.getState().settings.digits;
  const ShellRoot = shell.wrapper;
  function HostRoot({ children }: { readonly children: ReactNode }): ReactNode {
    return (
      <ShellRoot>
        <I18nProvider
          language={language}
          digits={digits}
          gameCatalogs={TALLY_CATALOGS}
          onError={failOnMissingMessage}
        >
          <GameHostProvider host={host}>{children}</GameHostProvider>
        </I18nProvider>
      </ShellRoot>
    );
  }
  return { wrapper: HostRoot, stores: shell.stores, host, save };
}
