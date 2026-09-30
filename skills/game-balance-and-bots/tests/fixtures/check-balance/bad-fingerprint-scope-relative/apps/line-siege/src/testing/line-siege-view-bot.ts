// apps/line-siege/src/testing/line-siege-view-bot.ts
import type { Cells } from '../board/cells.ts';
import { cellCount } from '../board/cells.ts';

export const count = (cells: Cells): number => cellCount(cells);
