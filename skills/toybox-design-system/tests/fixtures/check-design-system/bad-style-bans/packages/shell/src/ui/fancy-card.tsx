// packages/shell/src/ui/fancy-card.tsx
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import type { ReactNode } from 'react';

const SIZE = 60;
// shadowRadius in a comment is fine
const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    shadowRadius: 8,
    elevation: 4,
    borderRadius: 999,
  },
  dot: { borderRadius: SIZE / 2 },
  title: { fontSize: 22, fontWeight: '700', letterSpacing: 1 },
});

export function FancyCard(): ReactNode {
  return <View style={styles.card}><LinearGradient colors={[]} /><View style={styles.dot} /></View>;
}
