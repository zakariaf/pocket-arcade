// packages/shell/src/ui/offer-box.tsx
import { StyleSheet, View } from 'react-native';

import { makeStyles } from '@e07/shell/theme/make-styles.ts';

import { COMPONENT_SPECS } from './component-specs.ts';

import type { ReactNode } from 'react';

const OFFER = COMPONENT_SPECS.offer;

export type OfferBoxProps = {
  /** The pop "Continue - watch an ad" button and its caption. */
  readonly children: ReactNode;
  readonly testID: string;
};

const useStyles = makeStyles((theme) => {
  const styles = StyleSheet.create({
    // A dashed placeholder frame, no fill: "this is optional".
    box: {
      alignSelf: 'stretch',
      borderWidth: OFFER.border,
      borderStyle: 'dashed',
      borderColor: theme.colors.border,
      borderRadius: OFFER.radius,
      padding: OFFER.padding,
      gap: OFFER.gap,
    },
  });
  return styles;
});

/** The S7 lose offer: a dashed frame around the Continue button and its note. */
export function OfferBox({ children, testID }: OfferBoxProps): ReactNode {
  const styles = useStyles();
  return (
    <View style={styles.box} testID={testID}>
      {children}
    </View>
  );
}
