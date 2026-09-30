// packages/shell/src/config/art-config.ts (fixture excerpt: the definition is not a call)
/** withShell's last step: `return withGameArt(config, game.id);`. */
export function withGameArt<T>(config: T, gameId: string): T {
  return gameId === '' ? config : config;
}
