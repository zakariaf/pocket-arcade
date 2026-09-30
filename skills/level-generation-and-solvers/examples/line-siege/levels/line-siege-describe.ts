// apps/line-siege/src/levels/line-siege-describe.ts
// A level start as readable text for the data goldens: the hearts and the tray, the lanes (a kind
// letter and the health of each monster, the far end first) and the board ('#' block, '.' empty).
import { renderCells } from '@e07/game-kit/testing/render-cells.ts';
import { TUNING } from '@e07/line-siege/rules/line-siege-tuning.ts';

import type { LineSiegeState, MonsterKind } from '@e07/line-siege/rules/line-siege-types.ts';

const KIND_LETTER: Readonly<Record<MonsterKind, string>> = {
  normal: 'n',
  armoured: 'a',
  fast: 'f',
};

/** The lanes above the board: ' .' empty, else kind letter and health (n5 = normal, 5 health). */
function renderLanes(state: LineSiegeState): string {
  return Array.from({ length: TUNING.laneRows }, (_, row) =>
    Array.from({ length: TUNING.boardSize }, (_, lane) => {
      const monster = state.monsters.find((item) => item.lane === lane && item.row === row);
      return monster === undefined ? ' .' : `${KIND_LETTER[monster.kind]}${String(monster.hp)}`;
    }).join(' '),
  ).join('\n');
}

/** The golden text of a level start (the golden test adds the seed and the difficulty). */
export function describeLevel(state: LineSiegeState): string {
  const tray = state.tray.map((piece) => (piece === null ? '-' : String(piece))).join(',');
  return [
    `hearts ${String(state.hearts)} tray ${tray}`,
    renderLanes(state),
    renderCells(state.cells, TUNING.boardSize),
  ].join('\n');
}
