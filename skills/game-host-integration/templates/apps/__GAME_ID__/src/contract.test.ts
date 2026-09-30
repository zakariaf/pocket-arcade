// apps/__GAME_ID__/src/contract.test.ts
// The GameModule contract (spec 10): the module-wide checks every game runs next to its own tests.
import { levelsContractProblems } from '@e07/game-kit/levels/levels-contract.ts';
import { engineContractProblems } from '@e07/game-kit/testing/engine-contract.ts';
import { jsonShapeProblems } from '@e07/game-kit/testing/json-shape.ts';

import { __GAME_CAMEL__Game as game } from './index.ts';

import type { Catalog } from '@e07/game-kit/contract/messages.ts';

/** Must equal game.config.ts `levels` (check-game-app.mjs compares the two as well). */
const LEVEL_CONFIG = { packCount: 3, levelsPerPack: 30 };
const LANGUAGES = ['en', 'de', 'fa', 'ckb'] as const;
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Every catalog key the module hands to the Shell. */
function referencedKeys(): string[] {
  const { identity, levels, teaching, stats, rules, testing } = game;
  const keys = [identity.nameId, identity.winTitleId, identity.taglineId];
  keys.push(rules.hud(testing.examples.start()).goal.id);
  keys.push(...levels.packs.map((pack) => pack.nameId));
  keys.push(...teaching.tutorial.steps.map((step) => step.messageId));
  keys.push(...teaching.howToPlay.flatMap((page) => [page.titleId, page.bodyId]));
  keys.push(...stats.counters.map((counter) => counter.labelId));
  if (rules.continueRun.kind === 'once') keys.push(rules.continueRun.descriptionId);
  const lost = game.engine.outcome(testing.examples.lose());
  if (lost.kind === 'lost') keys.push(lost.reasonKey);
  return keys;
}

function missingIn(catalog: Catalog): string[] {
  return referencedKeys().filter((key) => !(key in catalog));
}

describe('__GAME_CAMEL__Game', () => {
  it('is named by its folder and by keys in all four catalogs', () => {
    expect(game.identity).toStrictEqual({
      id: '__GAME_ID__',
      nameId: '__GAME_ID__.name',
      winTitleId: '__GAME_ID__.win-title',
      taglineId: '__GAME_ID__.tagline',
    });
    expect(LANGUAGES.map((lang) => missingIn(game.texts[lang]))).toStrictEqual([[], [], [], []]);
  });

  it('hands the Shell its logo and complete licence credits', () => {
    const { logo, credits } = game.presentation.art;
    expect(logo.layers.length).toBeGreaterThan(0);
    for (const credit of credits) {
      expect([credit.name, credit.version, credit.license].every((text) => text !== '')).toBe(true);
    }
  });

  it('has the same keys in all four catalogs, each starting with the game id', () => {
    const english = Object.keys(game.texts.en).sort();
    expect(english.every((key) => key.startsWith('__GAME_ID__.'))).toBe(true);
    for (const lang of LANGUAGES)
      expect(Object.keys(game.texts[lang]).sort()).toStrictEqual(english);
  });

  it('keeps the engine contract on the first level of every pack and on the daily', () => {
    const starts = game.levels.packs.map(
      (pack) => game.levels.table[pack.firstLevel - 1] ?? { seed: 1, difficulty: 0 },
    );
    const problems = engineContractProblems({
      gameId: game.identity.id,
      engine: game.engine,
      persistence: game.persistence,
      starts: [...starts, { seed: 20_260_928, difficulty: 40 }],
      maxMoves: 60,
      intents: () => [],
    });
    expect(problems).toStrictEqual([]);
  });

  it('proves every shipped level winnable at its par, with packs matching game.config', () => {
    const problems = levelsContractProblems({
      levels: game.levels,
      engine: game.engine,
      config: LEVEL_CONFIG,
      maxNodes: 60_000,
    });
    expect(problems).toStrictEqual([]);
  });

  it('teaches in 3 to 5 pages and declares 2 to 4 kebab-case counters', () => {
    expect(game.teaching.howToPlay.length).toBeGreaterThanOrEqual(3);
    expect(game.teaching.howToPlay.length).toBeLessThanOrEqual(5);
    const ids = game.stats.counters.map((counter) => counter.id);
    expect(ids.length >= 2 && ids.length <= 4 && ids.every((id) => KEBAB.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every example state its promised outcome and keeps it JSON-safe', () => {
    const { examples } = game.testing;
    const kinds = [examples.start(), examples.middle(), examples.win(), examples.lose()].map(
      (state) => {
        expect(jsonShapeProblems(state)).toStrictEqual([]);
        return game.engine.outcome(state).kind;
      },
    );
    expect(kinds).toStrictEqual(['playing', 'playing', 'won', 'lost']);
  });

  it('is turn-based and saves after every move', () => {
    expect(game.realtime).toBeNull();
    expect(game.persistence.savePolicy).toStrictEqual({ kind: 'after-every-move' });
  });
});
