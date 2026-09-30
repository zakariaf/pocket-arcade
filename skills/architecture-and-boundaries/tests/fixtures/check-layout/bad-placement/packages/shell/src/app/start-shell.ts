// packages/shell/src/app/start-shell.ts
import { markJsEntry } from './perf/cold-start.ts';

markJsEntry();

/** Boots the Shell for one game. */
export function startShell(game: unknown): void {
  void game;
}
