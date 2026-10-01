import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@e07/shell/ui/app-text.tsx';
import { PrimaryButton } from '@e07/shell/ui/primary-button.tsx';

import type { ReactNode } from 'react';

type DailyCardProps = {
  readonly title: string;
  readonly date: string;
  readonly openLabel: string;
  readonly playLabel: string;
  readonly onOpen: () => void;
  readonly onPlay: () => void;
};

const styles = StyleSheet.create({
  card: { minHeight: 120 },
});

// Planted bug: the Play key sits inside the card's Pressable, so VoiceOver reads only the card.
export function DailyCard(props: DailyCardProps): ReactNode {
  return (
    <Pressable
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={props.openLabel}
      onPress={props.onOpen}
      testID="home.daily-card"
    >
      <View>
        <AppText text={props.title} />
        <AppText text={props.date} />
      </View>
      <PrimaryButton
        label={props.playLabel}
        onPress={props.onPlay}
        testID="home.daily-card.play-button"
      />
    </Pressable>
  );
}
