// apps/demo-grid/src/board/board-frame.tsx
import { StyleSheet, View } from 'react-native';

export function BoardFrame(props: { readonly children: React.ReactNode }): React.JSX.Element {
  return <View style={styles.mirrored}>{props.children}</View>;
}

const styles = StyleSheet.create({ mirrored: { transform: [{ scaleX: -1 }] } });
