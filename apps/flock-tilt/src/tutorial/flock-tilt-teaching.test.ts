// apps/flock-tilt/src/tutorial/flock-tilt-teaching.test.ts
import { layoutBoard } from '@e07/flock-tilt/board/layout-board.ts';
import { toView } from '@e07/flock-tilt/board/to-view.ts';
import ckb from '@e07/flock-tilt/i18n/ckb.json';
import de from '@e07/flock-tilt/i18n/de.json';
import en from '@e07/flock-tilt/i18n/en.json';
import fa from '@e07/flock-tilt/i18n/fa.json';
import { applyMove } from '@e07/flock-tilt/rules/apply-move.ts';
import { TILT_KEY_IDS } from '@e07/flock-tilt/rules/intent-to-move.ts';
import { listMoves } from '@e07/flock-tilt/rules/list-moves.ts';
import { outcome } from '@e07/flock-tilt/rules/outcome.ts';
import { cellRect } from '@e07/game-kit/geom/board-layout.ts';

import { FLOCK_TILT_TEACHING } from './flock-tilt-teaching.ts';

import type {
  FlockTiltEvent,
  FlockTiltMove,
  FlockTiltState,
} from '@e07/flock-tilt/rules/flock-tilt-types.ts';
import type { TutorialPointer } from '@e07/game-kit/contract/teaching.ts';

const { tutorial, howToPlay } = FLOCK_TILT_TEACHING;

type Played = { readonly state: FlockTiltState; readonly events: readonly FlockTiltEvent[] };

/** The tutorial's expected tilts, in order (every step names one). */
function expectedMoves(): FlockTiltMove[] {
  return tutorial.steps.map((step) => {
    if (step.expect.kind !== 'move') throw new Error(`${step.messageId} expects no single tilt`);
    return step.expect.move;
  });
}

/** Each scripted tilt applied in turn from the tutorial's start: the state and events after it. */
function playedSteps(): Played[] {
  const played: Played[] = [];
  let state = tutorial.start;
  for (const move of expectedMoves()) {
    const result = applyMove(state, move);
    played.push(result);
    state = result.state;
  }
  return played;
}

/** True when the pointer's cell exists in the board's layout of this state on a phone. */
function isOnBoard(state: FlockTiltState, pointer: TutorialPointer): boolean {
  if (pointer.kind === 'none') return true;
  if (pointer.kind !== 'target') return false;
  const view = toView(state, { formatNumber: String });
  const layout = layoutBoard({ width: 374, height: 660, view, isMirrored: false });
  return cellRect(layout, pointer.target) !== null;
}

describe('FLOCK_TILT_TEACHING (spec S13)', () => {
  it('teaches in 3 to 5 how-to-play pages drawn from playing examples', () => {
    expect(howToPlay.length).toBeGreaterThanOrEqual(3);
    expect(howToPlay.length).toBeLessThanOrEqual(5);
    expect(howToPlay.every((page) => outcome(page.example).kind === 'playing')).toBe(true);
  });

  it('expects a legal tilt at every step, and the scripted tilts win the tutorial', () => {
    const states = [tutorial.start, ...playedSteps().map((played) => played.state)];
    const legal = expectedMoves().map((move, index) =>
      listMoves(states[index] ?? tutorial.start).some(
        (listed) => listed.direction === move.direction,
      ),
    );
    expect(legal).toStrictEqual([true, true, true, true]);
    expect(outcome(states.at(-1) ?? tutorial.start).kind).toBe('won');
  });

  it('slides every sheep at once on the first tilt, as step 2 then says', () => {
    const [first] = playedSteps();
    const slid = first?.events.flatMap((event) =>
      event.kind === 'animals-slid' ? event.slides.filter((slide) => slide.animal === 'sheep') : [],
    );
    expect(slid?.length).toBe(tutorial.start.sheep.length);
  });

  it('drops a sheep into the pen on the tilt step 3 asks for', () => {
    const third = playedSteps()[2];
    expect(third?.events.map((event) => event.kind)).toContain('sheep-penned');
  });

  it('points at the key of each expected tilt, on the board', () => {
    const states = [tutorial.start, ...playedSteps().map((played) => played.state)];
    const pointed = tutorial.steps.map((step, index) => ({
      pointer: step.pointer,
      isOnBoard: isOnBoard(states[index] ?? tutorial.start, step.pointer),
    }));
    expect(pointed).toStrictEqual(
      expectedMoves().map((move) => ({
        pointer: {
          kind: 'target',
          target: { regionId: TILT_KEY_IDS[move.direction], col: 0, row: 0 },
        },
        isOnBoard: true,
      })),
    );
  });

  it('points only at cells on the board on the how-to-play pages', () => {
    expect(howToPlay.map((page) => isOnBoard(page.example, page.pointer))).toStrictEqual(
      howToPlay.map(() => true),
    );
  });

  it('shows the wolf on the last how-to-play page, which warns about it', () => {
    const last = howToPlay.at(-1);
    expect(last?.bodyId).toBe('flock-tilt.how-to-play.step-4');
    expect(last?.example.wolves.length).toBeGreaterThan(0);
  });

  it('finds every tutorial and how-to-play text in all four catalogs', () => {
    const keys = [
      ...tutorial.steps.map((step) => step.messageId),
      ...howToPlay.flatMap((page) => [page.titleId, page.bodyId]),
    ];
    const catalogs: readonly Readonly<Record<string, string>>[] = [en, de, fa, ckb];
    const missing = catalogs.flatMap((catalog) => keys.filter((key) => !(key in catalog)));
    expect(missing).toStrictEqual([]);
  });
});
