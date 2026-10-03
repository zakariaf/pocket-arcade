// packages/shell/src/game-host/shell-game-module.ts
import type { GameModule } from '@e07/game-kit/contract/game-module.ts';
import type { GameArt } from '@e07/shell/art/game-art.ts';
import type { GameBoard } from '@e07/shell/game-host/board-types.ts';
import type { SoundBank } from '@e07/shell/services/audio/audio-port.ts';
import type { Palette } from '@e07/shell/theme/theme-types.ts';

/** Names a game's types once; apps/<game>/src/<game>-types.ts declares the concrete bag. */
export type ShellGameTypes = {
  readonly state: unknown;
  readonly move: unknown;
  readonly event: unknown;
  readonly view: unknown;
  /** Board palette token names (BoardColors, the board and art palettes). */
  readonly token: string;
  /** Real-time games: the typed-array sim. Turn-based games: never. */
  readonly sim: unknown;
};

/**
 * The members game-kit cannot name because their types live in the Shell:
 * the Skia board, code-drawn art, the sound bank and the UI palette.
 */
export type GamePresentation<T extends ShellGameTypes> = {
  readonly board: GameBoard<T['state'], T['view'], T['token'], T['move']>;
  readonly art: GameArt<T['token']>;
  readonly sounds: SoundBank;
  readonly palette: Palette;
};

/** What apps/<game>/src/index.ts exports and startShell() accepts. */
export type ShellGameModule<T extends ShellGameTypes> = GameModule<
  T['state'],
  T['move'],
  T['event'],
  GamePresentation<T>,
  T['sim']
>;
