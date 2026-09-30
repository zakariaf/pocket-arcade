// packages/shell/src/config/with-shell.ts (fixture: the art is never added)
import type { ExpoConfig } from 'expo/config';

export function withShell(game: { readonly id: string }): ExpoConfig {
  return { name: game.id, slug: game.id };
}
