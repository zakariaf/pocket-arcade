// packages/shell/src/app/debug-link-routes.test.ts
import { createNavigationContainerRef } from '@react-navigation/native';

import { createLiveRunExit } from '@e07/shell/game-host/live-run-exit.ts';
import { createDefaultSaveDoc } from '@e07/shell/services/save/schema/default-save-doc.ts';

import {
  debugRouteFor,
  isGameExample,
  nextLevelOf,
  openDebugRoute,
  resetToFirstRoute,
} from './debug-link-routes.ts';

import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';
import type { NavigationState, ParamListBase } from '@react-navigation/native';

const RESULT = {
  stars: 3,
  bestScore: 0,
  bestMoves: null,
  completions: 1,
  firstCompletedOn: '2026-09-26',
} as const;

function wonUpTo(level: number): SaveDoc {
  const doc = createDefaultSaveDoc('line-siege');
  const levels = Object.fromEntries(
    Array.from({ length: level }, (_, index) => [String(index + 1), RESULT]),
  );
  return { ...doc, progress: { ...doc.progress, levels } };
}

describe('debug link routes', () => {
  it('names the navigator route of each screen', () => {
    expect(debugRouteFor('how-to-play', 1)).toStrictEqual({ name: 'HowToPlay' });
    expect(debugRouteFor('debug', 1)).toStrictEqual({ name: 'Debug' });
  });

  it('starts a new run of the level for screen=game', () => {
    expect(debugRouteFor('game', 12)).toStrictEqual({
      name: 'Game',
      params: { start: 'new', ref: { kind: 'level', level: 12 } },
    });
  });

  it('finds the next level like Home does, and stays on the last one', () => {
    expect(nextLevelOf(wonUpTo(0), 90)).toBe(1);
    expect(nextLevelOf(wonUpTo(11), 90)).toBe(12);
    expect(nextLevelOf(wonUpTo(3), 3)).toBe(3);
  });

  it('tells the game example states apart', () => {
    expect(isGameExample('result-win')).toBe(true);
    expect(isGameExample('game')).toBe(false);
    expect(isGameExample(undefined)).toBe(false);
  });
});

describe('openDebugRoute', () => {
  const HOME = { key: 'Home-1', name: 'Home' };
  /** A ready navigator whose stack holds Home, a finished level's Game and Levels (earlier links). */
  function readyNavigator() {
    const navigation = createNavigationContainerRef<ParamListBase>();
    const calls: unknown[] = [];
    const state = {
      routes: [HOME, { key: 'Game-2', name: 'Game' }, { key: 'Levels-3', name: 'Levels' }],
    } as unknown as NavigationState;
    jest.spyOn(navigation, 'isReady').mockReturnValue(true);
    jest.spyOn(navigation, 'getRootState').mockReturnValue(state);
    jest.spyOn(navigation, 'reset').mockImplementation((reset) => {
      calls.push(['reset', reset]);
    });
    jest.spyOn(navigation, 'navigate').mockImplementation((...args: unknown[]) => {
      calls.push(['navigate', ...args]);
    });
    return { navigation, calls };
  }

  it('lands screen= on a fixed stack: the first route alone, then the route on top of it', () => {
    const { navigation, calls } = readyNavigator();
    openDebugRoute(navigation, { name: 'Settings' });
    expect(calls).toStrictEqual([
      ['reset', { index: 0, routes: [HOME] }],
      ['navigate', 'Settings'],
    ]);
  });

  it('opens screen=home as the first route alone, and screen=game as a new run above it', () => {
    const home = readyNavigator();
    openDebugRoute(home.navigation, { name: 'Home' });
    expect(home.calls).toStrictEqual([['reset', { index: 0, routes: [HOME] }]]);
    const game = readyNavigator();
    const params = { start: 'new', ref: { kind: 'level', level: 3 } } as const;
    openDebugRoute(game.navigation, { name: 'Game', params });
    expect(game.calls).toStrictEqual([
      ['reset', { index: 0, routes: [HOME] }],
      ['navigate', 'Game', params],
    ]);
  });

  it('opens S15 on top of the current screen for a rejected link, keeping the screen it came from', () => {
    const { navigation, calls } = readyNavigator();
    openDebugRoute(navigation, { name: 'Debug' }, 'on-top');
    expect(calls).toStrictEqual([['navigate', 'Debug']]);
  });
});

describe('resetToFirstRoute (spec S5 and S6: only Pause -> Home leaves a live run)', () => {
  it("leaves the open Game screen's live run first, as Pause -> Home does, then resets", () => {
    const navigation = createNavigationContainerRef<ParamListBase>();
    const calls: unknown[] = [];
    const state = {
      routes: [
        { key: 'Home-1', name: 'Home' },
        { key: 'Game-2', name: 'Game' },
      ],
    };
    jest.spyOn(navigation, 'isReady').mockReturnValue(true);
    jest.spyOn(navigation, 'getRootState').mockReturnValue(state as unknown as NavigationState);
    jest.spyOn(navigation, 'reset').mockImplementation(() => {
      calls.push('reset');
    });
    const exit = createLiveRunExit();
    exit.register(() => calls.push('leave'));
    expect(resetToFirstRoute(navigation, exit)).toBe('Home');
    expect(calls).toStrictEqual(['leave', 'reset']);
  });

  it('leaves no run while the navigator is not ready (nothing is reset)', () => {
    const navigation = createNavigationContainerRef<ParamListBase>();
    const calls: string[] = [];
    jest.spyOn(navigation, 'isReady').mockReturnValue(false);
    const exit = createLiveRunExit();
    exit.register(() => calls.push('leave'));
    expect(resetToFirstRoute(navigation, exit)).toBeNull();
    expect(calls).toStrictEqual([]);
  });
});
