// packages/shell/src/app/debug-switches.test.ts
import { createNavigationContainerRef, StackActions } from '@react-navigation/native';

import { debugSwitchesOf } from './debug-switches.ts';

import type { DebugParts } from './create-debug-parts.ts';
import type { DebugServices } from '@e07/shell/screens/debug/debug-services.ts';
import type { ParamListBase } from '@react-navigation/native';

/** Whether this launch is a parity probe=board launch, as TEST_ONLY reports it. */
const mockProbe = { isOn: false };
jest.mock('@e07/shell/app/test-only.ts', () => ({
  TEST_ONLY: { isParityBoardProbeOn: () => mockProbe.isOn },
}));

function partsWith(services: Partial<DebugServices> | null): DebugParts {
  return {
    services: services === null ? null : (services as DebugServices),
    links: null,
    navigationRef: createNavigationContainerRef<ParamListBase>(),
  };
}

describe('debugSwitchesOf', () => {
  afterEach(() => {
    mockProbe.isOn = false;
  });

  it('keeps every switch off before the debug parts exist and in a store build', () => {
    const early = debugSwitchesOf(() => null);
    expect([early.isLayoutProbeOn(), early.seedOverride()]).toStrictEqual([false, null]);
    const store = debugSwitchesOf(() => partsWith(null));
    expect([store.isLayoutProbeOn(), store.seedOverride()]).toStrictEqual([false, null]);
  });

  it('turns the board-layout probe on for boardLayout=1 and for a parity probe=board launch', () => {
    const services = { isBoardLayoutOn: () => true, seedOverride: () => 42 };
    const linked = debugSwitchesOf(() => partsWith(services));
    expect([linked.isLayoutProbeOn(), linked.seedOverride()]).toStrictEqual([true, 42]);
    const plain = debugSwitchesOf(() => partsWith({ isBoardLayoutOn: () => false }));
    expect(plain.isLayoutProbeOn()).toBe(false);
    mockProbe.isOn = true;
    expect(plain.isLayoutProbeOn()).toBe(true);
  });

  it('pushes a new Game screen for the debug controls', () => {
    const parts = partsWith(null);
    const dispatch = jest
      .spyOn(parts.navigationRef, 'dispatch')
      .mockImplementation(() => undefined);
    const params = { start: 'new', ref: { kind: 'level', level: 1 } } as const;
    debugSwitchesOf(() => parts).openGame(params);
    expect(dispatch).toHaveBeenCalledWith(StackActions.push('Game', params));
  });
});
