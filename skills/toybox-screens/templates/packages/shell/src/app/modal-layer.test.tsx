// packages/shell/src/app/modal-layer.test.tsx
import { screen } from '@testing-library/react-native';
import { useEffect } from 'react';
import { View } from 'react-native';

import { ParityLaunchContext, parityLaunchTestID } from '@e07/shell/app/parity-launch-marker.tsx';
import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { ModalLayer } from './modal-layer.tsx';

import type { ReactNode } from 'react';

type HostNode = { readonly parent: HostNode | null; readonly props: Record<string, unknown> };

/** The nearest ancestor holding `prop` at `value`, if any. */
function ancestorWith(node: HostNode, prop: string, value: unknown): HostNode | null {
  for (let at = node.parent; at !== null; at = at.parent) {
    if (at.props[prop] === value) return at;
  }
  return null;
}

/** A screen behind the layer that counts its mounts: the layer must never remount it. */
function CountingScreen({ onMount }: { readonly onMount: () => void }): ReactNode {
  useEffect(onMount, [onMount]);
  return <View testID="probe.behind" />;
}

const HIDDEN = { includeHiddenElements: true } as const;

// Spec 8.11 (screen readers) and S3, S6, S7, S14: a layer over the app keeps VoiceOver and
// TalkBack inside it, and the screen behind stays mounted.
describe('ModalLayer', () => {
  it('draws only what lies behind, reachable, while no layer is up', async () => {
    await renderWithShell(<ModalLayer behind={<View testID="probe.behind" />} layer={null} />);
    const behind = screen.getByTestId('probe.behind');
    expect(ancestorWith(behind, 'importantForAccessibility', 'no-hide-descendants')).toBeNull();
    expect(screen.queryByTestId('probe.layer', HIDDEN)).toBeNull();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('keeps VoiceOver inside the layer and hides what lies behind from TalkBack', async () => {
    await renderWithShell(
      <ModalLayer behind={<View testID="probe.behind" />} layer={<View testID="probe.layer" />} />,
    );
    const layer = screen.getByTestId('probe.layer');
    expect(ancestorWith(layer, 'accessibilityViewIsModal', true)).not.toBeNull();
    expect(ancestorWith(layer, 'importantForAccessibility', 'no-hide-descendants')).toBeNull();
    const behind = screen.getByTestId('probe.behind', HIDDEN);
    expect(ancestorWith(behind, 'importantForAccessibility', 'no-hide-descendants')).not.toBeNull();
    expect(ancestorWith(behind, 'accessibilityViewIsModal', true)).toBeNull();
    expect(screen.queryByTestId('probe.behind')).not.toBeOnTheScreen();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('opens and closes over the screen behind without remounting it', async () => {
    const onMount = jest.fn();
    const behind = <CountingScreen onMount={onMount} />;
    const { rerender } = await renderWithShell(<ModalLayer behind={behind} layer={null} />);
    await rerender(<ModalLayer behind={behind} layer={<View testID="probe.layer" />} />);
    expect(screen.getByTestId('probe.layer')).toBeOnTheScreen();
    await rerender(<ModalLayer behind={behind} layer={null} />);
    expect(screen.getByTestId('probe.behind')).toBeOnTheScreen();
    expect(onMount).toHaveBeenCalledTimes(1);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it("draws the parity launch's marker inside the layer, where a capture's hierarchy reaches it", async () => {
    await renderWithShell(
      <ParityLaunchContext value="n7">
        <ModalLayer behind={null} layer={<View testID="probe.layer" />} />
      </ParityLaunchContext>,
    );
    const marker = screen.getByTestId(parityLaunchTestID('n7'));
    expect(ancestorWith(marker, 'accessibilityViewIsModal', true)).not.toBeNull();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});
