// packages/shell/src/ui/how-to-stage.tsx
import { StyleSheet, View } from 'react-native';

import { makeStyles } from '@e07/shell/theme/make-styles.ts';

import { COMPONENT_SPECS } from './component-specs.ts';

import type { ReactNode } from 'react';

const STAGE = COMPONENT_SPECS.howToStage;

export type HowToStageProps = {
  /** The game's how-to picture for this step (full width, height by its aspect). */
  readonly children: ReactNode;
  readonly testID: string;
};

const useStyles = makeStyles((theme) => {
  const styles = StyleSheet.create({
    stage: {
      alignSelf: 'stretch',
      padding: STAGE.padding,
      borderWidth: STAGE.border,
      borderRadius: STAGE.radius,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
  });
  return styles;
});

/** The S13 stage that frames each how-to picture. */
export function HowToStage({ children, testID }: HowToStageProps): ReactNode {
  const styles = useStyles();
  return (
    <View style={styles.stage} testID={testID}>
      {children}
    </View>
  );
}
