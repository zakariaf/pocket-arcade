// packages/shell/src/game-host/hud-model.test.ts
import { hudView, MODE_LABEL_KEYS } from './hud-model.ts';

const HUD = { score: 40, goal: { id: 'tally.goal', values: { target: 4 } } };
const LEVEL_3 = { level: 3, seed: 3, difficulty: 3, stars: { kind: 'par', par: 3 } } as const;

describe('hudView', () => {
  it('shows "Moves / Par" on a par-rated level', () => {
    const view = hudView({
      ref: { kind: 'level', level: 3 },
      moveCount: 2,
      hud: HUD,
      entry: LEVEL_3,
    });
    expect(view).toStrictEqual({
      mode: { kind: 'level', level: 3 },
      goal: { kind: 'moves-par', moves: 2, par: 3 },
      score: 40,
    });
  });

  it("shows the game's own goal line on a daily run and on score-rated levels", () => {
    const daily = hudView({
      ref: { kind: 'daily', date: '2026-09-28' },
      moveCount: 2,
      hud: HUD,
      entry: null,
    });
    expect(daily.goal).toStrictEqual({ kind: 'game', message: HUD.goal });
    const scored = { ...LEVEL_3, stars: { kind: 'score', thresholds: [10, 20, 30] } } as const;
    const level = hudView({
      ref: { kind: 'level', level: 3 },
      moveCount: 2,
      hud: HUD,
      entry: scored,
    });
    expect(level.goal.kind).toBe('game');
  });

  it('labels every run kind with a Shell key and the tutorial with none', () => {
    expect(MODE_LABEL_KEYS).toStrictEqual({
      level: 'game-screen.mode.level',
      daily: 'game-screen.mode.daily',
      endless: 'common.mode.endless',
      tutorial: null,
    });
  });
});
