// packages/shell/src/screens/result/result-overlay.tsx
import { StyleSheet, View } from 'react-native';

import { ParityLaunchMarker } from '@e07/shell/app/parity-launch-marker.tsx';

import { ResultDailyView } from './result-daily-view.tsx';
import { ResultEndlessView } from './result-endless-view.tsx';
import { ResultLoseView } from './result-lose-view.tsx';
import { ResultWinView } from './result-win-view.tsx';

import type { ResultModel } from './result-model.ts';
import type { ReactNode } from 'react';

export type ResultOverlayProps = { readonly model: ResultModel };

const styles = StyleSheet.create({ fill: { ...StyleSheet.absoluteFill } });

function viewFor(model: ResultModel): ReactNode {
  switch (model.kind) {
    case 'win':
      return <ResultWinView model={model} />;
    case 'lose':
      return <ResultLoseView model={model} />;
    case 'daily':
      return <ResultDailyView model={model} />;
    case 'endless':
      return <ResultEndlessView model={model} />;
  }
}

/**
 * S7 as an overlay inside Game (never a route): it covers the finished board completely, and
 * VoiceOver stays inside it (accessibilityViewIsModal) instead of wandering onto the board. The
 * parity launch marker comes first (it draws nothing outside a parity capture), because the modal
 * layer hides the parity root's own marker from the capture's hierarchy.
 */
export function ResultOverlay({ model }: ResultOverlayProps): ReactNode {
  return (
    <View style={styles.fill} accessibilityViewIsModal>
      <ParityLaunchMarker />
      {viewFor(model)}
    </View>
  );
}
