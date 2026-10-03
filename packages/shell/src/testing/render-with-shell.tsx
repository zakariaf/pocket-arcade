// packages/shell/src/testing/render-with-shell.tsx — every component test renders through this.
// It builds in memory what the app's composition root (createShellApp) builds: a first-launch save
// over the fake SaveStore, the test's seed written through SaveService.update, the stores created
// from that save by their real factories, the Shell ThemeProvider over the test palette, and the
// Shell I18nProvider (real Shell catalogs; a missing message throws) and DirectionProvider.
// Only the ports the test passes exist: any other port throws on first use and names itself.
import { render } from '@testing-library/react-native';

import { ServicesProvider } from '@e07/shell/app/services-context.tsx';
import { StoresProvider } from '@e07/shell/app/stores-context.tsx';
import { DirectionProvider } from '@e07/shell/i18n/direction-context.tsx';
import { I18nProvider } from '@e07/shell/i18n/i18n-provider.tsx';
import { directionOf } from '@e07/shell/i18n/languages.ts';
import { createFakeSaveStore } from '@e07/shell/services/save/fake-save-store.ts';
import { planLoad } from '@e07/shell/services/save/load-plan.ts';
import { createSaveService } from '@e07/shell/services/save/save-service.ts';
import { createShellStores } from '@e07/shell/stores/create-shell-stores.ts';
import { ThemeProvider } from '@e07/shell/theme/theme-provider.tsx';
import { createThemeSet } from '@e07/shell/theme/theme-set.ts';

import { TEST_PALETTE } from './test-palette.ts';

import type { Services } from '@e07/shell/app/services-context.tsx';
import type { ShellStores } from '@e07/shell/app/stores-context.tsx';
import type { Direction, Language } from '@e07/shell/i18n/languages.ts';
import type { Catalog } from '@e07/shell/i18n/messages.ts';
import type { ClockPort } from '@e07/shell/services/clock/clock-port.ts';
import type { ErrorLogPort } from '@e07/shell/services/error-log/error-log-port.ts';
import type { SaveService } from '@e07/shell/services/save/save-service.ts';
import type { SaveSettings } from '@e07/shell/services/save/schema/save-doc.ts';
import type { Palette } from '@e07/shell/theme/theme-types.ts';
import type { RenderResult } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';

export type RenderWithShellOptions = {
  /** The UI language (what resolveLanguage picked at boot). Default 'en'. */
  readonly language?: Language;
  /** The layout direction. Default: the language's own (fa and ckb are 'rtl'). */
  readonly direction?: Direction;
  /** Theme colours. Scheme and mode follow settings.theme and settings.colorBlind. */
  readonly palette?: Palette;
  /** Saved settings, written before the stores exist, like a save loaded at boot. */
  readonly settings?: Partial<SaveSettings>;
  /** The save's premium section says owned, as after a purchase or a restore. */
  readonly isPremium?: boolean;
  /** The fakes the test uses. `save` defaults to the seeded in-memory save. */
  readonly services?: Partial<Services>;
};

export type ShellWrapper = {
  readonly wrapper: (props: { readonly children: ReactNode }) => ReactNode;
  /** The stores the tree reads; dispatch on them to change state from outside React. */
  readonly stores: ShellStores;
};

export type ShellRenderResult = RenderResult & { readonly stores: ShellStores };

const NO_GAME: Readonly<Record<Language, Catalog>> = { en: {}, de: {}, fa: {}, ckb: {} };
/** 2026-09-26 12:00 UTC, 12 h before midnight. The save's clock unless the test passes services.clock. */
const TEST_CLOCK: ClockPort = {
  nowMs: () => 1_790_424_000_000,
  today: () => '2026-09-26',
  msUntilNextLocalDay: () => 43_200_000,
};
/** An invalid seed fails the test with the validation error itself. */
const THROWING_ERROR_LOG: ErrorLogPort = {
  record: (_source, error) => {
    throw error;
  },
  entries: () => [],
};

function failOnMissingMessage(error: Error): never {
  throw error;
}

/** A port the test did not pass: reading any member throws an error that names the port. */
function missingPort<TName extends keyof Services>(name: TName): Services[TName] {
  return new Proxy({} as Services[TName], {
    get: (_target, member) => {
      throw new Error(`renderWithShell: pass services.${name} (read .${String(member)})`);
    },
  });
}

/** Every port: the test's fake where it passed one, a throwing stand-in otherwise. */
export function createTestServices(services: Partial<Services> = {}): Services {
  const port = <TName extends keyof Services>(name: TName): Services[TName] =>
    services[name] ?? missingPort(name);
  return {
    ads: port('ads'),
    audio: port('audio'),
    clock: port('clock'),
    connectivity: port('connectivity'),
    consent: port('consent'),
    errorLog: port('errorLog'),
    haptics: port('haptics'),
    purchase: port('purchase'),
    save: port('save'),
  };
}

/** A first launch as the Shell's hydrateSave runs it: empty slots -> default document -> writes. */
function createFirstLaunchSave(services: Partial<Services>): SaveService {
  const plan = planLoad({ current: null, backup: null, gameId: 'shell-test' });
  const deps = {
    store: createFakeSaveStore(),
    clock: services.clock ?? TEST_CLOCK,
    errorLog: services.errorLog ?? THROWING_ERROR_LOG,
    appVersion: '1.0.0',
    isStrict: true,
  };
  const save = createSaveService(deps, plan, 0);
  save.applyLoadWrites();
  return save;
}

/** Writes the seed through the single writer (validated), before any store reads the save. */
function seedSave(save: SaveService, options: RenderWithShellOptions): void {
  const { settings, isPremium = false } = options;
  if (settings === undefined && !isPremium) return;
  save.update((doc) => ({
    ...doc,
    settings: { ...doc.settings, ...settings },
    premium: isPremium
      ? { ...doc.premium, owned: true, ownedSinceMs: TEST_CLOCK.nowMs(), revokedAtMs: null }
      : doc.premium,
  }));
}

/** The provider tree for render() and renderHook(), and the stores it provides. */
export function createShellWrapper(options: RenderWithShellOptions = {}): ShellWrapper {
  const language = options.language ?? 'en';
  const save = options.services?.save ?? createFirstLaunchSave(options.services ?? {});
  seedSave(save, options);
  // The same factory, from the same document, as createShellApp.
  const stores = createShellStores(save);
  const services = createTestServices({ ...options.services, save });
  const themes = createThemeSet(options.palette ?? TEST_PALETTE);
  const wrapper = ({ children }: { readonly children: ReactNode }): ReactNode => (
    <I18nProvider
      language={language}
      digits={save.doc().settings.digits}
      gameCatalogs={NO_GAME}
      onError={failOnMissingMessage}
    >
      <DirectionProvider direction={options.direction ?? directionOf(language)}>
        <StoresProvider stores={stores}>
          <ThemeProvider themes={themes}>
            <ServicesProvider services={services}>{children}</ServicesProvider>
          </ThemeProvider>
        </StoresProvider>
      </DirectionProvider>
    </I18nProvider>
  );
  return { wrapper, stores };
}

export async function renderWithShell(
  ui: ReactElement,
  options: RenderWithShellOptions = {},
): Promise<ShellRenderResult> {
  const { wrapper, stores } = createShellWrapper(options);
  const result = await render(ui, { wrapper });
  return Object.assign(result, { stores });
}
