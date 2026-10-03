// packages/shell/src/ui/segmented-control.tsx
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@e07/shell/theme/use-theme.ts';

import { AppText } from './app-text.tsx';
import { COMPONENT_SPECS } from './component-specs.ts';
import { Icon } from './icons/icon.tsx';
import { RaisedSurface } from './raised-surface.tsx';

import type { Language } from '@e07/shell/i18n/languages.ts';
import type { ReactNode } from 'react';

const SEG = COMPONENT_SPECS.segmentedControl;

export type Segment<TValue extends string> = {
  readonly value: TValue;
  /** Translated label ("System", "Light", "Dark"). */
  readonly label: string;
  /** Optional second line, e.g. the digits preview "123" or "۱۲۳". */
  readonly preview?: string;
  /** The preview's own language when its script differs from the UI (Persian digits). */
  readonly previewLanguage?: Language;
};

export type SegmentedControlProps<TValue extends string> = {
  readonly segments: readonly Segment<TValue>[];
  readonly selected: TValue;
  readonly onSelect: (value: TValue) => void;
  /** Translated group name for VoiceOver ("Theme"). */
  readonly label: string;
  /** The radiogroup's id, e.g. `settings.theme-control`. */
  readonly testID: string;
  /** Segments get `<base>.<value>`, e.g. `settings.theme-segment` gives `settings.theme-segment.dark`. */
  readonly segmentTestIDBase: string;
  readonly isReducedMotion: boolean;
  /** Inside a settings row the labels are 14 pt instead of 15. */
  readonly isInRow?: boolean;
};

const styles = StyleSheet.create({
  group: { flexDirection: 'row', gap: SEG.gap, alignSelf: 'stretch' },
  cell: { flex: 1 },
  // faceGap (1, label line to preview line) and labelColumnGap (3, check to label) are mockup
  // overrides the token file lacks; write-component-specs.mjs adds them to the specs.
  face: {
    minHeight: SEG.minHeight,
    minWidth: 0,
    paddingBlock: SEG.paddingBlock,
    paddingInline: SEG.paddingInline,
    gap: SEG.faceGap,
  },
  labelRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: SEG.labelColumnGap,
  },
});

function previewLine(
  preview: string,
  language: Language | undefined,
  props: PreviewProps,
): ReactNode {
  return (
    <AppText
      text={preview}
      variant="segmentPreview"
      tone={props.tone}
      align="center"
      testID={props.testID}
      {...(language === undefined ? {} : { language })}
    />
  );
}

type PreviewProps = { readonly tone: 'onPrimary' | 'default'; readonly testID: string };

function segmentFace<TValue extends string>(
  props: SegmentedControlProps<TValue>,
  segment: Segment<TValue>,
  ink: { readonly color: string; readonly tone: 'onPrimary' | 'default' },
): ReactNode {
  const id = `${props.segmentTestIDBase}.${segment.value}`;
  const isSelected = segment.value === props.selected;
  return (
    <>
      <View style={styles.labelRow}>
        {isSelected ? <Icon name="check" color={ink.color} size={SEG.checkIcon} /> : null}
        <AppText
          text={segment.label}
          variant={props.isInRow === true ? 'segmentLabelInRow' : 'segmentLabel'}
          tone={ink.tone}
          align="center"
          testID={`${id}.label`}
        />
      </View>
      {segment.preview === undefined
        ? null
        : previewLine(segment.preview, segment.previewLanguage, {
            tone: ink.tone,
            testID: `${id}.preview`,
          })}
    </>
  );
}

/** Equal raised segments; the chosen one is pushed in, filled accent and carries a check. */
export function SegmentedControl<TValue extends string>(
  props: SegmentedControlProps<TValue>,
): ReactNode {
  const theme = useTheme();
  return (
    <View
      style={styles.group}
      accessibilityRole="radiogroup"
      accessibilityLabel={props.label}
      testID={props.testID}
    >
      {props.segments.map((segment) => {
        const isSelected = segment.value === props.selected;
        const ink = isSelected
          ? { color: theme.colors.onPrimary, tone: 'onPrimary' as const }
          : { color: theme.colors.icon, tone: 'default' as const };
        return (
          <RaisedSurface
            key={segment.value}
            label={segment.label}
            onPress={() => {
              props.onSelect(segment.value);
            }}
            testID={`${props.segmentTestIDBase}.${segment.value}`}
            accessibilityRole="radio"
            isSelected={isSelected}
            isPushedIn={isSelected}
            elevation={SEG.elevation}
            radius={SEG.radius}
            edgeWidth={SEG.border}
            fill={isSelected ? theme.colors.primary : theme.colors.surface}
            isReducedMotion={props.isReducedMotion}
            faceStyle={styles.face}
            layoutStyle={styles.cell}
          >
            {segmentFace(props, segment, ink)}
          </RaisedSurface>
        );
      })}
    </View>
  );
}
