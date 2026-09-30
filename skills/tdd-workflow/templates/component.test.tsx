// packages/shell/src/__AREA__/__FILE_NAME__.test.tsx
// Spec __SPEC_ID__: "__SPEC_QUOTE__"
// Render through renderWithShell, find by role and accessible name, press with userEvent, and
// await every render and press (the testing library is async).
import { screen, userEvent } from '@testing-library/react-native';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { __COMPONENT_NAME__ } from './__FILE_NAME__.tsx';

describe('__COMPONENT_NAME__', () => {
  it('__BEHAVIOUR_TITLE__ (spec __SPEC_ID__)', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await renderWithShell(<__COMPONENT_NAME__ __PROPS__ onPress={onPress} />);

    await user.press(screen.getByRole('button', { name: '__ACCESSIBLE_NAME__' }));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});
