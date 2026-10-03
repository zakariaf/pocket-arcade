// packages/shell/src/testing/create-host-wrapper.test.tsx
import { renderHook } from '@testing-library/react-native';

import { useServices } from '@e07/shell/app/services-context.tsx';
import { useGameHost } from '@e07/shell/game-host/game-host-context.tsx';
import { gameMessageText } from '@e07/shell/i18n/game-message-text.ts';
import { useT } from '@e07/shell/i18n/t-context.ts';

import { createHostWrapper, TALLY_TEXTS } from './create-host-wrapper.tsx';
import { TALLY_GAME } from './tally-game.ts';

/**
 * Every message id the tally game names, read through its own module: identity, HUD goal, lose
 * reason, continue, packs, board summary, tutorial, how-to-play and counters. A hook test that
 * reaches any of them (S5 top bar, S7 result, S8 packs, S13, S10) must find a text.
 */
function tallyMessageIds(): readonly string[] {
  const { identity, rules, levels, presentation, teaching, stats, testing } = TALLY_GAME;
  const lost = TALLY_GAME.engine.outcome(testing.examples.lose());
  return [
    identity.nameId,
    identity.taglineId,
    identity.winTitleId,
    rules.hud(testing.examples.start()).goal.id,
    ...(lost.kind === 'lost' ? [lost.reasonKey] : []),
    ...(rules.continueRun.kind === 'once' ? [rules.continueRun.descriptionId] : []),
    ...levels.packs.map((pack) => pack.nameId),
    presentation.board.describe(testing.examples.middle()).id,
    ...teaching.tutorial.steps.map((step) => step.messageId),
    ...teaching.howToPlay.flatMap((page) => [page.titleId, page.bodyId]),
    ...stats.counters.map((counter) => counter.labelId),
  ];
}

function useProbe() {
  const t = useT();
  const host = useGameHost();
  const { save } = useServices();
  return { name: gameMessageText(t, { id: host.nameId }), host, save, back: t('common.back') };
}

describe('createHostWrapper', () => {
  it('provides the tally host, its texts next to the Shell catalogs, and one shared save', async () => {
    const shell = createHostWrapper();
    const { result } = await renderHook(() => useProbe(), { wrapper: shell.wrapper });

    expect(result.current.name).toBe('Tally');
    expect(result.current.back).toBe('Back');
    expect(result.current.host).toBe(shell.host);
    expect(result.current.save).toBe(shell.save);
    expect(shell.host.counters.map((counter) => counter.id)).toStrictEqual(['adds', 'biggest-add']);
  });

  it('has a text for every message id the tally game names (no MISSING_TRANSLATION in S5-S13)', () => {
    const missing = tallyMessageIds().filter((id) => !(id in TALLY_TEXTS));
    expect(missing).toStrictEqual([]);
  });

  it('lays the test host fields over the real host', async () => {
    const shell = createHostWrapper({ host: { hasMusic: true } });
    const { result } = await renderHook(() => useGameHost(), { wrapper: shell.wrapper });

    expect(result.current.hasMusic).toBe(true);
    expect(result.current.nameId).toBe('tally.name');
  });

  it('saves a run end and publishes it to the stores, as the composition root does', () => {
    const shell = createHostWrapper();
    const opened = shell.host.openSession({ start: 'new', ref: { kind: 'endless' } });
    if (opened === null) throw new Error('no endless run');
    // Tally endless: 2 + 2 + 2 + 2 + 1 + 2 = 11 goes past the target 10.
    for (const col of [1, 1, 1, 1, 0, 1]) {
      const target = { regionId: 'board', col, row: 0 };
      opened.handle.send({ type: 'intent', intent: { kind: 'tap', target, selected: null } });
    }
    opened.handle.send({ type: 'finish' });

    const best = shell.save.doc().progress.endlessBest;
    expect(best).toBeGreaterThan(0);
    expect(shell.stores.progress.getState().progress.endlessBest).toBe(best);
    expect(shell.stores.stats.getState().stats.gamesPlayed).toBe(1);
  });
});
