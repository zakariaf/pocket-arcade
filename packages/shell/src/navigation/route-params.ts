// packages/shell/src/navigation/route-params.ts
import type { RunRef } from '@e07/shell/services/save/schema/save-doc.ts';

/**
 * Game (S5): continue the saved run, or start a new one.
 * Params stay small, serialisable data: no functions, no class instances, no whole sessions.
 * Every other route takes no params: screens read what they need from the stores.
 * `replay` numbers S13's "Play the tutorial again" (the host's tutorial run count), so a replay
 * asked over an open tutorial is new params and the open Game screen starts it afresh.
 */
export type GameParams =
  | { readonly start: 'resume' }
  | { readonly start: 'new'; readonly ref: RunRef; readonly replay?: number };
