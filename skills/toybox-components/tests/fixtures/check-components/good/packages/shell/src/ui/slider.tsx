// packages/shell/src/ui/slider.tsx
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { useDirection } from '@e07/shell/i18n/direction-context.tsx';
import { makeStyles } from '@e07/shell/theme/make-styles.ts';

import { COMPONENT_SPECS } from './component-specs.ts';
import { hardShadow } from './toybox-styles.ts';

import type { ReactNode } from 'react';
import type { AccessibilityActionEvent, LayoutChangeEvent } from 'react-native';

const SLIDER = COMPONENT_SPECS.slider;
/** VoiceOver swipes up/down move the value by 10 %. */
export const SLIDER_STEP = 0.1;
const PERCENT = 100;
const ACTIONS = [{ name: 'increment' }, { name: 'decrement' }] as const;

export type SliderProps = {
  /** 0..1 */
  readonly value: number;
  readonly onChange: (value: number) => void;
  /** Translated name ("Volume"). */
  readonly label: string;
  readonly testID: string;
  /** The sound or music it controls is off: the fill turns textMuted. */
  readonly isOff?: boolean;
};

const useStyles = makeStyles((theme) => {
  const styles = StyleSheet.create({
    target: { flex: 1, height: SLIDER.height, minWidth: SLIDER.minWidth },
    track: {
      position: 'absolute',
      top: SLIDER.trackTop,
      start: 0,
      end: 0,
      height: SLIDER.trackHeight,
      borderRadius: SLIDER.trackRadius,
      borderWidth: SLIDER.trackBorder,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.sunken,
      overflow: 'hidden',
    },
    fill: {
      height: '100%',
      backgroundColor: theme.colors.primary,
      borderEndWidth: SLIDER.trackBorder,
      borderEndColor: theme.colors.border,
    },
    fillOff: { backgroundColor: theme.colors.textMuted },
    thumb: {
      position: 'absolute',
      top: SLIDER.thumbTop,
      width: SLIDER.thumb,
      height: SLIDER.thumb,
      borderRadius: SLIDER.thumbRadius,
      borderWidth: SLIDER.thumbBorder,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      ...hardShadow(SLIDER.thumbElevation, theme.colors.shadow),
    },
  });
  return styles;
});

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** A volume slider: a 44 pt target, fill from the start edge, a raised square thumb. */
export function Slider(props: SliderProps): ReactNode {
  const styles = useStyles();
  const direction = useDirection();
  const [width, setWidth] = useState(0);
  const value = clamp01(props.value);
  const valueAt = (x: number): number => {
    const ratio = width > 0 ? clamp01(x / width) : value;
    return direction === 'rtl' ? 1 - ratio : ratio;
  };
  const pan = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    .onBegin((event) => {
      props.onChange(valueAt(event.x));
    })
    .onUpdate((event) => {
      props.onChange(valueAt(event.x));
    });
  const handleLayout = (event: LayoutChangeEvent): void => {
    setWidth(event.nativeEvent.layout.width);
  };
  const handleAction = (event: AccessibilityActionEvent): void => {
    const delta = event.nativeEvent.actionName === 'increment' ? SLIDER_STEP : -SLIDER_STEP;
    props.onChange(clamp01(Math.round((value + delta) * PERCENT) / PERCENT));
  };
  const thumbOffset = value * width - SLIDER.thumb / 2;
  return (
    <GestureDetector gesture={pan}>
      <View
        style={styles.target}
        onLayout={handleLayout}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={props.label}
        accessibilityValue={{ min: 0, max: PERCENT, now: Math.round(value * PERCENT) }}
        accessibilityActions={ACTIONS}
        onAccessibilityAction={handleAction}
        testID={props.testID}
      >
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              props.isOff === true && styles.fillOff,
              { width: `${String(value * PERCENT)}%` },
            ]}
            testID={`${props.testID}.fill`}
          />
        </View>
        {width > 0 ? <View style={[styles.thumb, { start: thumbOffset }]} /> : null}
      </View>
    </GestureDetector>
  );
}
