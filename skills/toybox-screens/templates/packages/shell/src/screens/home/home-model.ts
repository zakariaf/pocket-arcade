// packages/shell/src/screens/home/home-model.ts
// What S4 Home draws. use-home-model.ts builds it from the stores; HomeView only draws it.
import type { LogoArt } from '@e07/shell/art/logo-art.ts';
import type { AdBannerSlotProps } from '@e07/shell/ui/ad-banner-slot.tsx';

export type HomeBanner = Pick<AdBannerSlotProps, 'renderBanner' | 'isAllowed'>;

export type HomeDaily = {
  /** date.weekday-day-month, formatted by the Shell date formatter in the UI language. */
  readonly dateText: string;
  readonly streakDays: number;
  /** Today's challenge is finished: the play button becomes the "done" line. */
  readonly isDoneToday: boolean;
};

export type HomeActions = {
  readonly onPlay: () => void;
  readonly onPlayDaily: () => void;
  readonly onPlayEndless: () => void;
  readonly onOpenSettings: () => void;
  readonly onOpenLevels: () => void;
  readonly onOpenStats: () => void;
  readonly onOpenHowToPlay: () => void;
  readonly onOpenPremium: () => void;
};

export type HomeModel = {
  /** The module's GAME_ART.logo (useGameHost().logo; the restart splash reads the module). */
  readonly logo: LogoArt;
  /** games.<id>.name and games.<id>.tagline. */
  readonly gameName: string;
  readonly tagline: string;
  /** The game has an Endless mode (spec 8.2). */
  readonly hasEndless: boolean;
  readonly isPremium: boolean;
  readonly isReducedMotion: boolean;
  /** "Continue – Level 12" while a run is saved, else "Play – Level 13" (the next unfinished level). */
  readonly play: { readonly isContinue: boolean; readonly level: number };
  readonly daily: HomeDaily;
  readonly bestEndlessScore: number;
  /** shouldShowBanner(config, context, 'home'): false for Premium, offline or no consent. */
  readonly banner: HomeBanner;
  readonly actions: HomeActions;
};
