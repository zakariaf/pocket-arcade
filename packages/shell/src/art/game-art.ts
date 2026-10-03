// packages/shell/src/art/game-art.ts
import type { CreditEntry } from './credit-entry.ts';
import type { LogoArt } from './logo-art.ts';
import type { PaletteSet } from '@e07/shell/game-host/board-kit.ts';

/**
 * What each game exports from apps/<game>/src/art/game-art.ts as GAME_ART: `presentation.art` of
 * its ShellGameModule. Plain data only; the Shell reads every member at runtime.
 */
export type GameArt<TToken extends string> = {
  /** The four board palettes (light, dark, colour-blind light and dark): the board's colours. */
  readonly palettes: PaletteSet<TToken>;
  /**
   * The game's LOGO_ART. LogoTile draws it on the splash (S1), Home (S4), the lose screen (S7),
   * Statistics (S10) and About (S11b); render-art.ts draws the app icon and the native splash from
   * the same data, so every picture of the game is one design.
   */
  readonly logo: LogoArt;
  /** The game's own S11d licence rows (a word list, an extra font); [] for most games. */
  readonly credits: readonly CreditEntry[];
};
