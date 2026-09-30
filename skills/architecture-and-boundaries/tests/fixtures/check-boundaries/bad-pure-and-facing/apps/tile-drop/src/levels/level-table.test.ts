// apps/tile-drop/src/levels/level-table.test.ts
import { BOT_NAME } from '@demo/tile-drop/testing/tile-drop-bot.ts';

it('names the witness bot', () => {
  expect(BOT_NAME).toBe('greedy');
});
