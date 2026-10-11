// packages/shell/src/ui/dialogs.test.tsx
import { fireEvent, screen, userEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';
import { TEST_PALETTE } from '@e07/shell/testing/test-palette.ts';
import { SHELL_COLORS } from '@e07/shell/theme/shell-colors.ts';

import { Button } from './button.tsx';
import { DialogButtonRow } from './dialog-button-row.tsx';
import { DialogCard } from './dialog-card.tsx';
import { HoldButton } from './hold-button.tsx';
import { Scrim } from './scrim.tsx';
import { ToastStack } from './toast-stack.tsx';
import { Toast } from './toast.tsx';

import type { StyleProp, ViewStyle } from 'react-native';

const HIDDEN = { includeHiddenElements: true } as const;
const SHELL = SHELL_COLORS.light;
const COLORS = TEST_PALETTE.standard.light;

describe('DialogCard', () => {
  it('gives the card, title and body their parts and a static 8 pt hard shadow', async () => {
    const onCancel = jest.fn();
    const user = userEvent.setup();
    await renderWithShell(
      <Scrim testID="reset-progress-dialog.scrim">
        <DialogCard
          testIDBase="reset-progress-dialog"
          title="Reset all progress?"
          body="Stars, scores and your streak will be gone."
        >
          <DialogButtonRow testID="reset-progress-dialog.buttons">
            <Button
              label="Cancel"
              kind="secondary"
              onPress={onCancel}
              testID="reset-progress-dialog.cancel-button"
              isInRow
              isReducedMotion
            />
            <Button
              label="Reset"
              kind="danger"
              onPress={jest.fn()}
              testID="reset-progress-dialog.confirm-button"
              isInRow
              isReducedMotion
            />
          </DialogButtonRow>
        </DialogCard>
      </Scrim>,
    );

    expect(screen.getByRole('header', { name: 'Reset all progress?' })).toBeOnTheScreen();
    expect(screen.getByTestId('reset-progress-dialog.body')).toBeOnTheScreen();
    expect(screen.getByTestId('reset-progress-dialog.card')).toHaveStyle({
      borderRadius: 22,
      boxShadow: [
        { offsetX: 0, offsetY: 8, blurRadius: 0, spreadDistance: 0, color: COLORS.shadow },
      ],
    });
    expect(screen.getByTestId('reset-progress-dialog.scrim')).toHaveStyle({
      backgroundColor: SHELL.scrim,
      paddingInline: 20,
    });
    expect(screen.getByTestId('reset-progress-dialog.buttons')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('paints the card in its edge colour with the surface laid inside the edge, so no pale hairline shows at the rounded corners', async () => {
    await renderWithShell(
      <DialogCard testIDBase="save-restored-dialog" title="Progress restored">
        <Button
          label="OK"
          onPress={jest.fn()}
          testID="save-restored-dialog.ok-button"
          isReducedMotion
        />
      </DialogCard>,
    );

    // A fill under the edge bled a 1/3 pt pale seam past the antialiased corners onto the hard
    // shadow (E15's S14 sign-off, light mode): the card is an EdgedFace, like every key's face.
    const card = screen.getByTestId('save-restored-dialog.card');
    // allow-style-assertion: the paint order is the fix; only the styles show it in Jest
    expect(card).toHaveStyle({ backgroundColor: COLORS.border, borderColor: COLORS.border });
    const [plate] = card.queryAll(
      (node) =>
        node.type === 'View' &&
        StyleSheet.flatten(node.props['style'] as StyleProp<ViewStyle>)?.position === 'absolute' &&
        node.parent === card,
    );
    expect(plate).toHaveStyle({ borderRadius: 19, backgroundColor: COLORS.surface });
  });

  it('makes the scrim the modal root, so its testID stays in the accessibility tree', async () => {
    await renderWithShell(
      <Scrim testID="restart-dialog.scrim">
        <DialogCard testIDBase="restart-dialog" title="Restart to apply?">
          <Button
            label="Later"
            onPress={jest.fn()}
            testID="restart-dialog.later-button"
            isReducedMotion
          />
        </DialogCard>
      </Scrim>,
    );

    // A modal card would hide the scrim's testID (and the screen under it) from VoiceOver's tree,
    // which is also what Maestro and the parity capture read (S14: "screen not reached").
    expect(screen.getByTestId('restart-dialog.scrim')).toHaveProp('accessibilityViewIsModal', true);
    expect(screen.getByTestId('restart-dialog.card')).not.toHaveProp('accessibilityViewIsModal');
  });
});

describe('HoldButton', () => {
  it('ignores a short tap', async () => {
    const onConfirm = jest.fn();
    const user = userEvent.setup();
    await renderWithShell(
      <HoldButton
        label="Hold to reset"
        hint="Hold for 2 seconds"
        onConfirm={onConfirm}
        testID="reset-progress-dialog.confirm-button"
        isReducedMotion
      />,
    );

    await user.press(screen.getByRole('button', { name: 'Hold to reset' }));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('confirms through the activate action for screen-reader users', async () => {
    const onConfirm = jest.fn();
    await renderWithShell(
      <HoldButton
        label="Hold to reset"
        hint="Hold for 2 seconds"
        onConfirm={onConfirm}
        testID="reset-progress-dialog.confirm-button"
        isReducedMotion={false}
      />,
    );

    const button = screen.getByRole('button', { name: 'Hold to reset' });
    expect(button).toHaveProp('accessibilityActions', [{ name: 'activate' }]);
    await fireEvent(button, 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('reset-progress-dialog.confirm-button.fill')).toHaveStyle({
      backgroundColor: SHELL.dangerFill,
    });
  });
});

describe('HoldButton frozen for a capture', () => {
  it('shows the fill held at frozenProgress and never fills or confirms on a press', async () => {
    const onConfirm = jest.fn();
    const user = userEvent.setup();
    await renderWithShell(
      <HoldButton
        label="Hold to reset"
        hint="Hold for 2 seconds"
        onConfirm={onConfirm}
        testID="reset-progress-dialog.confirm-button"
        isReducedMotion
        frozenProgress={0.46}
      />,
    );

    const fill = screen.getByTestId('reset-progress-dialog.confirm-button.fill');
    expect(fill).toHaveStyle({ width: '46%' });
    await user.press(screen.getByRole('button', { name: 'Hold to reset' }));
    expect(fill).toHaveStyle({ width: '46%' });
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('measures the fill share on the whole face, not inside its padding (.hf width: var(--h))', async () => {
    await renderWithShell(
      <HoldButton
        label="Hold to reset"
        hint="Hold for 2 seconds"
        onConfirm={jest.fn()}
        testID="reset-progress-dialog.confirm-button"
        isReducedMotion
        frozenProgress={0.46}
      />,
    );

    // Yoga resolves an absolute child's percentage width inside the face's padding (46 % of 278 pt
    // where the design fills 46 % of 310): the fill sits in a track pinned to the face's edges.
    const track = screen.getByTestId('reset-progress-dialog.confirm-button.fill').parent;
    expect(track).toHaveStyle({ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 });
  });
});

describe('Toast', () => {
  it('is an alert on the inverted chip with no outline', async () => {
    await renderWithShell(
      <ToastStack testID="premium.restore-results">
        <Toast
          text="Restoring purchases"
          icon="busy"
          testID="premium.restoring-toast"
          isReducedMotion
        />
        <Toast
          text="Purchases restored"
          icon="check"
          testID="premium.restore-success-toast"
          isReducedMotion
          delayMs={0}
        />
      </ToastStack>,
    );

    // Both wait out the drop-in at opacity 0 (hidden from VoiceOver until they land).
    expect(screen.getAllByRole('alert', { includeHiddenElements: true })).toHaveLength(2);
    expect(screen.getByTestId('premium.restore-success-toast', HIDDEN)).toHaveStyle({
      backgroundColor: SHELL.toastBackground,
      borderRadius: 12,
    });
    expect(screen.getByTestId('premium.restore-success-toast', HIDDEN)).not.toHaveStyle({
      borderWidth: 3,
    });
    expect(screen.getByText('Purchases restored', HIDDEN)).toHaveStyle({ color: SHELL.toastText });
    expect(screen.getByTestId('premium.restore-results')).toHaveStyle({ gap: 10 });
  });
});
