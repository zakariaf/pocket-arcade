// apps/line-siege/src/art/game-art.test.ts
import { BOARD_PALETTES } from '@e07/line-siege/board/board-palettes.ts';

import { GAME_ART } from './game-art.ts';
import { LOGO_ART } from './logo-art.ts';

describe('GAME_ART', () => {
  it('hands the Shell the four board palette sets, the one Line Siege logo and no credits of its own (spec N9: all art is drawn in code)', () => {
    expect(GAME_ART.palettes).toBe(BOARD_PALETTES);
    expect(GAME_ART.logo).toBe(LOGO_ART);
    expect(GAME_ART.credits).toStrictEqual([]);
  });
});
