// apps/jump-chain/src/tutorial/jump-chain-teaching.test.ts
// Spec S13: "The first level is a guided tutorial: a pointer hand shows what to do, one short
// sentence at a time ... Every game has 3 to 5 How to play steps, each with a small picture drawn
// by the game's own board code."
import { cellRect } from '@e07/game-kit/geom/board-layout.ts';
import { layoutBoard } from '@e07/jump-chain/board/layout-board.ts';
import { toView } from '@e07/jump-chain/board/to-view.ts';
import ckb from '@e07/jump-chain/i18n/ckb.json';
import de from '@e07/jump-chain/i18n/de.json';
import en from '@e07/jump-chain/i18n/en.json';
import fa from '@e07/jump-chain/i18n/fa.json';
import { applyMove } from '@e07/jump-chain/rules/apply-move.ts';
import { intentToMove } from '@e07/jump-chain/rules/intent-to-move.ts';
import { listMoves } from '@e07/jump-chain/rules/list-moves.ts';
import { outcome } from '@e07/jump-chain/rules/outcome.ts';

import { JUMP_CHAIN_TEACHING } from './jump-chain-teaching.ts';

import type { TutorialPointer } from '@e07/game-kit/contract/teaching.ts';
import type { JumpChainState } from '@e07/jump-chain/rules/jump-chain-types.ts';

const CATALOGS: readonly Readonly<Record<string, string>>[] = [en, de, fa, ckb];
const PHONE = { width: 374, height: 660 };

/** Every square a pointer names is a square of the board the game draws. */
function isOnBoard(state: JumpChainState, pointer: TutorialPointer): boolean {
  const layout = layoutBoard({
    ...PHONE,
    view: toView(state, { formatNumber: String }),
    isMirrored: false,
  });
  switch (pointer.kind) {
    case 'target':
      return cellRect(layout, pointer.target) !== null && pointer.target.row >= 0;
    case 'drag':
      return [pointer.from, pointer.to].every(
        (target) =>
          target.regionId === 'board' && target.row >= 0 && cellRect(layout, target) !== null,
      );
    case 'hud':
    case 'none':
      return true;
  }
}

/** The tutorial played step by step: each state with the step that is shown in it. */
function walk(): { state: JumpChainState; index: number }[] {
  const { start, steps } = JUMP_CHAIN_TEACHING.tutorial;
  const seen: { state: JumpChainState; index: number }[] = [];
  let state = start;
  steps.forEach((step, index) => {
    seen.push({ state, index });
    if (step.expect.kind === 'move') state = applyMove(state, step.expect.move).state;
  });
  return seen;
}

describe('JUMP_CHAIN_TEACHING', () => {
  it('scripts three steps, each expecting one legal move, and the scripted moves win', () => {
    const { start, steps } = JUMP_CHAIN_TEACHING.tutorial;
    expect(steps).toHaveLength(3);
    const end = steps.reduce((state, step) => {
      if (step.expect.kind !== 'move') throw new Error('every step expects a move');
      expect(listMoves(state)).toContainEqual(step.expect.move);
      return applyMove(state, step.expect.move).state;
    }, start);
    expect(outcome(end).kind).toBe('won');
  });

  it('points the hand along the drag that plays exactly the expected move', () => {
    for (const { state, index } of walk()) {
      const step = JUMP_CHAIN_TEACHING.tutorial.steps[index];
      if (step?.pointer.kind !== 'drag' || step.expect.kind !== 'move') {
        throw new Error('every step drags');
      }
      const intent = { kind: 'drag-end', from: step.pointer.from, to: step.pointer.to } as const;
      expect(intentToMove(state, intent)).toStrictEqual(step.expect.move);
      expect(isOnBoard(state, step.pointer)).toBe(true);
    }
  });

  it('steps up first, then jumps a chain of two, then jumps again after the ranks advanced', () => {
    const { start, steps } = JUMP_CHAIN_TEACHING.tutorial;
    const first = steps[0]?.expect;
    const second = steps[1]?.expect;
    if (first?.kind !== 'move' || second?.kind !== 'move') throw new Error('moves expected');
    expect(first.move.kind).toBe('step');
    expect(second.move.kind === 'jump' ? second.move.path.length : 0).toBe(2);
    const afterChain = applyMove(applyMove(start, first.move).state, second.move);
    expect(afterChain.events.map((event) => event.kind)).toContain('ranks-advanced');
  });

  it('teaches in 3 to 5 how-to-play pages drawn from playing examples', () => {
    const pages = JUMP_CHAIN_TEACHING.howToPlay;
    expect(pages.length).toBeGreaterThanOrEqual(3);
    expect(pages.length).toBeLessThanOrEqual(5);
    expect(pages.every((page) => outcome(page.example).kind === 'playing')).toBe(true);
    expect(pages.every((page) => isOnBoard(page.example, page.pointer))).toBe(true);
  });

  it('shows on each how-to-play page a drag the board would play, where it points one', () => {
    for (const page of JUMP_CHAIN_TEACHING.howToPlay) {
      if (page.pointer.kind !== 'drag') continue;
      const intent = { kind: 'drag-end', from: page.pointer.from, to: page.pointer.to } as const;
      expect(intentToMove(page.example, intent)).not.toBeNull();
    }
  });

  it('names only keys that are in all four catalogs', () => {
    const { tutorial, howToPlay } = JUMP_CHAIN_TEACHING;
    const keys = [
      ...tutorial.steps.map((step) => step.messageId),
      ...howToPlay.flatMap((page) => [page.titleId, page.bodyId]),
    ];
    const missing = keys.filter((key) => CATALOGS.some((catalog) => catalog[key] === undefined));
    expect(missing).toStrictEqual([]);
  });
});
