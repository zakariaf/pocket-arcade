// packages/shell/src/app/create-shell-parts.ts (fixture: the composition root's run-end part only)
import { createGameHost } from '@e07/shell/game-host/game-host.ts';
import { recordLevelEnd } from '@e07/shell/services/ads/ad-history.ts';

import type { RunSummary } from '@e07/shell/game-host/run-summary.ts';
import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';

/** The ads layer's part of the ONE run-end update: a finished level counts toward the caps. */
function recordAdLevelEnd(doc: SaveDoc, summary: RunSummary): SaveDoc {
  if (summary.ref.kind !== 'level') return doc;
  const history = recordLevelEnd(doc.ads.history, summary.isWon ? 'win' : 'lose');
  return { ...doc, ads: { ...doc.ads, history } };
}

export function hostFor(game: unknown, deps: Record<string, unknown>): unknown {
  return createGameHost(game, {
    ...deps,
    extendRunEnd: recordAdLevelEnd,
  });
}
