import { Pressable, View } from 'react-native';

import { AppText } from './app-text.tsx';

import type { ReactNode } from 'react';

export type ListRowProps = {
  readonly label: string;
  readonly valueText: string;
  readonly isOn: boolean;
  readonly onPress: () => void;
  readonly testID: string;
};

function rowContent(props: ListRowProps): ReactNode {
  return (
    <View>
      <AppText text={props.label} />
      <AppText text={props.valueText} />
    </View>
  );
}

// No accessibilityLabel on purpose: VoiceOver reads the row's own texts in order.
export function ListRow(props: ListRowProps): ReactNode {
  const content = rowContent(props);
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: props.isOn }}
      onPress={props.onPress}
      style={{ minHeight: 60 }}
      testID={props.testID}
    >
      {content}
    </Pressable>
  );
}
