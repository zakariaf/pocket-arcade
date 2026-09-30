# Toybox motion

Every animation, its timing and its reduce-motion alternative. The values live in `packages/shell/src/theme/motion.ts` (`EASING`, `MOTION_MS`, `RELEASE_SPRING`, `PRESS_SQUASH`, `KEYFRAMES`).

## Easings

- **boing** `cubic-bezier(.34, 1.7, .6, 1)`: overshoots about 14 %.
- **slide** `cubic-bezier(.2, .8, .2, 1)`.
- **ease-out** `(0, 0, .58, 1)`, **ease-in-out** `(.42, 0, .58, 1)`.

In Reanimated: `Easing.bezier(...EASING.boing)`.

## The motion table

| Moment | Duration | Easing / spring | Keyframes | Reduce motion |
|---|---|---|---|---|
| Press in: sink and squash | 70 ms | ease-out | depth 0 to 1 | sink without squash; shadow swap instant |
| Release: spring back | 320 ms | boing; RN `withSpring({ damping: 12, stiffness: 420, mass: 1 })` | depth 1 to 0 with overshoot | instant return |
| Fill colour change (press, select) | 120 ms | ease (ease-out while pressing) | | instant |
| Toggle knob slides | 300 ms | boing | start to end (22 pt) | instant |
| Result stars pop in, one by one | 540 ms each, delays 250 / 400 / 550 ms | boing | scale 0, -30 deg; 1.22, 8 deg (55 %); 0.94, -2 deg (78 %); 1, 0 deg | all three shown filled at once, 120 ms fade |
| Sticker slap (win title, New best, Premium active) | 420 ms, delays 700 ms (win title) and 950 ms (New best) | boing | from scale 1.7, tilt -14 deg, opacity 0 to scale 1, tilt, opacity 1 | 120 ms fade |
| Toast drops in | 380 ms, delay 500 ms | boing | translateY 22, scale 0.9, opacity 0 to rest | 120 ms fade |
| Screen push | 260 ms | slide; moves in the reading direction (mirrors in RTL) | | 150 ms cross-fade |
| Current level tile bobs | 1600 ms loop | ease-in-out | translateY 0, -3, 0 | no loop |
| Busy blocks hop (buttons, splash) | 900 ms loop, 120 ms stagger | boing | 0 % / 60 % / 100 %: 0; 30 %: -7 | static blocks plus the busy text |
| Hold to confirm (S14 reset) | 2000 ms | linear fill from the start edge (**Chosen**; the mockup draws a static 46 % fill) | `dangerFill` width 0 to 100 % | unchanged (functional timer, `ReduceMotion.Never`) |
| Confetti (S12 success) | with the success sticker's slap (**Chosen**) | boing | falls into place | hidden |

## Spring mass

**Chosen:** `mass: 1` is written out because Reanimated 4.5.1's `withSpring` defaults mass to 4, which makes the release twice as slow and much bouncier. With mass 1 the spring overshoots about 38 % of the press depth (1.9 pt on a 5 pt key) where the CSS curve overshoots about 14 %. If the motion itself must ever match the mockup exactly, use `withTiming(0, { duration: 320, easing: Easing.bezier(0.34, 1.7, 0.6, 1) })`, which reproduces the CSS.

## Reduce motion in code

- The Shell setting "Reduce motion" (System / on / off) is read through `useReduceMotion()` (`packages/shell/src/app/use-reduce-motion.ts`: the setting, or the phone's switch when it is System); never Reanimated's `useReducedMotion()` (a constant captured at module load, verified in Reanimated 4.5.1's source).
- A root `<ReducedMotionConfig mode={isReduced ? ReduceMotion.Always : ReduceMotion.Never} />` (the `MotionConfig` component in `packages/shell/src/app/motion-config.tsx`, mounted once inside the providers) makes every `withTiming`/`withSpring` that keeps the default `reduceMotion: ReduceMotion.System` follow the setting: timings and springs finish instantly. Without it, the in-app "on" setting would only remove the squash while the 70 ms sink and the spring still animate.
- The squash is removed explicitly: screen models pass `isReducedMotion` into `RaisedSurface`, which then only sinks.
- Loops (bob, hop) are not started at all when reduced; busy states show static blocks plus their text.
- The hold-to-confirm timer passes `reduceMotion: ReduceMotion.Never`: it is a safety timer, not decoration.
- Fades that replace a motion use `MOTION_MS.reducedFade` (120 ms) or `reducedCrossFade` (150 ms).
