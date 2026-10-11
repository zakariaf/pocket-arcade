// packages/shell/src/ui/edged-face.test.tsx
// allow-style-assertion: the paint order is the fix for the pale hairline; only the styles show it in Jest.
import { screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { AppText } from './app-text.tsx';
import { EdgedFace } from './edged-face.tsx';

import type { StyleProp, ViewStyle } from 'react-native';

const EDGE = '#1D1B3A';
const FILL = '#F8FBFF';

const styles = StyleSheet.create({
  card: { borderWidth: 3, borderColor: EDGE, borderRadius: 22, padding: 10 },
  tight: { borderWidth: 3 },
});

describe('EdgedFace', () => {
  it('paints the face in its edge colour and lays the fill inside the edge, so no pale hairline bleeds past the rounded corners', async () => {
    await renderWithShell(
      <EdgedFace
        testID="restart-dialog.card"
        style={styles.card}
        edgeColor={EDGE}
        fill={FILL}
        edgeWidth={3}
        radius={22}
      >
        <AppText text="Restart to apply" />
      </EdgedFace>,
    );

    const face = screen.getByTestId('restart-dialog.card');
    expect(face).toHaveStyle({ backgroundColor: EDGE, borderRadius: 22, padding: 10 });
    const plates = face.queryAll(
      (node) =>
        node.type === 'View' &&
        StyleSheet.flatten(node.props['style'] as StyleProp<ViewStyle>)?.position === 'absolute',
    );
    expect(plates).toHaveLength(1);
    expect(plates[0]).toHaveStyle({
      top: 0,
      bottom: 0,
      start: 0,
      end: 0,
      borderRadius: 19,
      backgroundColor: FILL,
    });
    expect(screen.getByText('Restart to apply')).toBeOnTheScreen();
  });

  it('keeps the fill plate radius at zero or more', async () => {
    await renderWithShell(
      <EdgedFace
        testID="pause.dialog"
        style={styles.tight}
        edgeColor={EDGE}
        fill={FILL}
        edgeWidth={3}
        radius={2}
      >
        <AppText text="Paused" />
      </EdgedFace>,
    );

    const [plate] = screen
      .getByTestId('pause.dialog')
      .queryAll(
        (node) =>
          node.type === 'View' &&
          StyleSheet.flatten(node.props['style'] as StyleProp<ViewStyle>)?.position === 'absolute',
      );
    expect(plate).toHaveStyle({ borderRadius: 0 });
  });
});
