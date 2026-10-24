// packages/shell/src/game-host/coach-hand-layer.tsx
// device-only: covered by the tutorial on the simulator and the tutorial pixel golden (a Skia Picture; unit Jest has no Skia).
// The tutorial's pointing hand (spec S13) as its own picture over the board's, inside BoardCanvas:
// its glide is worked out once per layout and cells, and only this picture is recorded again as
// the hand moves, never the board's (whose picture follows the scene and the finger alone).
import { Picture, Skia } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import {
  cancelAnimation,
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import {
  COACH_HAND_LOOP_MS,
  COACH_HAND_LOOPS,
  coachHandGlide,
  coachHandKey,
  isCoachHandGliding,
} from './draw-coach-hand.ts';
import { recordCoachHand } from './record-board.ts';

import type { RenderKit } from './board-types.ts';
import type { BoardCoachHand } from './draw-coach-hand.ts';
import type { BoardLayout } from '@e07/game-kit/geom/board-layout.ts';
import type { Motion } from '@e07/game-kit/timeline/track.ts';
import type { ReactNode } from 'react';
import type { SharedValue } from 'react-native-reanimated';

/**
 * The hand's phase: it glides from the slot to the gap COACH_HAND_LOOPS times, again each time
 * `key` changes (another hand, or a refused tutorial try). It rests at the gap (null key) under
 * reduced motion and for a plain target, which has no slot to glide from (isCoachHandGliding).
 */
function useCoachHandPhase(key: string | null): SharedValue<number> {
  const phase = useSharedValue(1);
  useEffect(() => {
    cancelAnimation(phase);
    if (key === null) {
      phase.set(1);
      return;
    }
    phase.set(0);
    const loop = withTiming(1, { duration: COACH_HAND_LOOP_MS, easing: Easing.linear });
    phase.set(withRepeat(loop, COACH_HAND_LOOPS, false));
  }, [key, phase]);
  return phase;
}

export type CoachHandLayerProps = {
  readonly hand: BoardCoachHand;
  /** Grows with each try the tutorial refused: the hand then glides again. */
  readonly replay: number;
  /** Reduce motion: the hand rests at the gap instead of gliding there. */
  readonly motion: Motion;
  /** The board's layout (BoardCanvas's derived value): the hand's glide follows it. */
  readonly layout: SharedValue<BoardLayout>;
  readonly kit: RenderKit;
};

export function CoachHandLayer({
  hand,
  replay,
  motion,
  layout,
  kit,
}: CoachHandLayerProps): ReactNode {
  const isGliding = isCoachHandGliding(hand.hand, motion);
  const phase = useCoachHandPhase(isGliding ? coachHandKey({ hand: hand.hand, replay }) : null);
  // One recorder per hand layer, reused every frame; created in render, never at import time.
  const [recorder] = useState(() => Skia.PictureRecorder());
  const glide = useDerivedValue(() => coachHandGlide(layout.get(), hand));
  const picture = useDerivedValue(() =>
    recordCoachHand(
      recorder,
      { layout: layout.get(), glide: glide.get(), look: hand.look, kit },
      phase.get(),
    ),
  );
  return <Picture picture={picture} />;
}
