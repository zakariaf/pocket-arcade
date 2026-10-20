// apps/flock-tilt/src/board/build-timeline.ts
// Pure: the events of one tilt become the short film the board plays. Channels:
//   pos    (per animal) [col, row] -> [col, row]: the slide, accelerating as the field tilts
//   bump   (per animal) [1, dx, dy] -> [0, dx, dy]: the squash against what stopped it (full only)
//   drop   (per sheep)  [1] -> [0]: a sheep shrinking into the pen as it arrives
//   burst  (per sheep)  particles from the pen (full motion only)
//   lost   (per sheep)  [1] -> [0]: the flash on a sheep the wolf got
//   glow   (turn)       [1] -> [0]: the field glows when every sheep is home
//   tired  (turn)       [1] -> [0]: the field dims when the tilts ran out
//   rewind (turn)       [1] -> [0]: the continue took the last tilt back
import { sheepEntity, TURN_ENTITY, wolfEntity } from './board-ids.ts';

import type { Direction, FlockTiltEvent, Slide } from '@e07/flock-tilt/rules/flock-tilt-types.ts';
import type { Motion, Track } from '@e07/game-kit/timeline/track.ts';

/** Longest a tilt may animate; build-timeline.test.ts enforces it. */
export const TURN_BUDGET_MS = 1400;
/** A slide's time: a start plus a share per cell travelled (a field is 7 cells). */
const SLIDE_BASE_MS = 70;
const SLIDE_PER_CELL_MS = 45;
const BUMP_MS = 150;
const DROP_MS = 220;
/** The event that carries the slide itself. */
const SLID = 'animals-slid';
const BURST_MS = 600;
const FLASH_MS = 500;
/** The field is 7 x 7; cells are row * 7 + col (the board draws whatever the view says). */
const COLS = 7;

/** Reduced motion: half durations, no particles, no bumps, no overshoot. */
type Timing = { readonly scale: number; readonly isFull: boolean };

const STEP: Readonly<Record<Direction, readonly [number, number]>> = {
  up: [0, -1],
  right: [1, 0],
  down: [0, 1],
  left: [-1, 0],
};

function colRow(cell: number): [number, number] {
  return [cell % COLS, Math.floor(cell / COLS)];
}

function entityOf(slide: Slide): number {
  return slide.animal === 'sheep' ? sheepEntity(slide.id) : wolfEntity(slide.id);
}

function slideMs(slide: Slide, timing: Timing): number {
  const [fromCol, fromRow] = colRow(slide.from);
  const [toCol, toRow] = colRow(slide.to);
  const cells = Math.abs(toCol - fromCol) + Math.abs(toRow - fromRow);
  return (SLIDE_BASE_MS + SLIDE_PER_CELL_MS * cells) * timing.scale;
}

/** Every animal slides at once; the first carries the tilt's sound and haptic. */
function slid(slides: readonly Slide[], timing: Timing): Track[] {
  return slides.map((slide, order) => ({
    channel: 'pos',
    entityId: entityOf(slide),
    startMs: 0,
    durationMs: slideMs(slide, timing),
    easing: timing.isFull ? 'in-quad' : 'linear',
    from: colRow(slide.from),
    to: colRow(slide.to),
    ...(order === 0 ? { cue: { sound: 'tilt', haptic: 'light' as const } } : {}),
  }));
}

/** Each animal that hit something squashes against it; the first bump carries its thud. */
function bumped(slides: readonly Slide[], direction: Direction, timing: Timing): Track[] {
  if (!timing.isFull) return [];
  const [dx, dy] = STEP[direction];
  return slides
    .filter((slide) => slide.stoppedBy !== 'pen')
    .map((slide, order) => ({
      channel: 'bump',
      entityId: entityOf(slide),
      startMs: slideMs(slide, timing),
      durationMs: BUMP_MS,
      easing: 'out-quad',
      from: [1, dx, dy],
      to: [0, dx, dy],
      ...(order === 0 ? { cue: { sound: 'bump' } } : {}),
    }));
}

/** A sheep dropped into the pen: it shrinks in as it arrives, and the pen bursts. */
function penned(id: number, arrivalMs: number, timing: Timing): Track[] {
  const at = { entityId: sheepEntity(id), startMs: arrivalMs } as const;
  const drop: Track = {
    ...at,
    channel: 'drop',
    durationMs: DROP_MS * timing.scale,
    easing: 'in-quad',
    from: [1],
    to: [0],
    cue: { sound: 'pen', haptic: 'medium' },
  };
  const burst: Track = {
    ...at,
    channel: 'burst',
    durationMs: BURST_MS,
    easing: 'linear',
    from: [0],
    to: [1],
  };
  return timing.isFull ? [drop, burst] : [drop];
}

/** What a one-shot fade needs: which channel and entity, when, and its cue if it has one. */
type Flash = Pick<Track, 'channel' | 'entityId' | 'startMs' | 'cue'>;

/** A one-shot fade (a lost sheep, the cleared field, the run-out, the continue). */
function flash(at: Flash): Track {
  return { ...at, durationMs: FLASH_MS, easing: 'out-quad', from: [1], to: [0] };
}

/**
 * The tracks of what a settled tilt caused, starting when the last animal stopped. A won or lost
 * field sounds once, through the Shell's ui.win and ui.lose (the game host's result step), and the
 * continue follows the Shell's dialog, so those flashes carry no cue of their own.
 */
function settledTracks(event: FlockTiltEvent, settledMs: number, timing: Timing): Track[] {
  switch (event.kind) {
    case 'sheep-lost': {
      const cue = { sound: 'bleat', haptic: 'warning' } as const;
      return [flash({ channel: 'lost', entityId: sheepEntity(event.id), startMs: settledMs, cue })];
    }
    case 'field-cleared': {
      const startMs = settledMs + DROP_MS * timing.scale;
      return [flash({ channel: 'glow', entityId: TURN_ENTITY, startMs })];
    }
    case 'tilts-ran-out':
      return [flash({ channel: 'tired', entityId: TURN_ENTITY, startMs: settledMs })];
    case 'tilt-taken-back':
      return [flash({ channel: 'rewind', entityId: TURN_ENTITY, startMs: 0 })];
    case SLID:
    case 'sheep-penned':
      return [];
  }
}

/** The events of one tilt, in order: the slide first, then what it caused when it settled. */
export function buildTimeline(events: readonly FlockTiltEvent[], motion: Motion): readonly Track[] {
  const timing = { scale: motion === 'full' ? 1 : 0.5, isFull: motion === 'full' };
  const slides = events.flatMap((event) => (event.kind === SLID ? event.slides : []));
  const settledMs = slides.reduce((end, slide) => Math.max(end, slideMs(slide, timing)), 0);
  const arrival = (id: number): number => {
    const slide = slides.find((one) => one.animal === 'sheep' && one.id === id);
    return slide === undefined ? 0 : slideMs(slide, timing);
  };
  return events.flatMap((event): Track[] => {
    if (event.kind === SLID) {
      return [...slid(event.slides, timing), ...bumped(event.slides, event.direction, timing)];
    }
    if (event.kind === 'sheep-penned') return penned(event.id, arrival(event.id), timing);
    return settledTracks(event, settledMs, timing);
  });
}
