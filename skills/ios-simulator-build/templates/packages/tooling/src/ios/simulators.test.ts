// packages/tooling/src/ios/simulators.test.ts
import {
  deleteOwnSimulator,
  ensureSimulator,
  findSimulator,
  simulatorName,
  statusBarArgs,
  type SimctlDeviceList,
} from './simulators.ts';
import { IOS_RUNTIME } from './toolchain.ts';

const LIST: SimctlDeviceList = {
  devices: {
    [IOS_RUNTIME]: [
      { name: 'e07-parity', udid: 'AAA', state: 'Booted', isAvailable: true },
      { name: 'e07-smoke', udid: 'BBB', state: 'Shutdown', isAvailable: true },
    ],
    'com.apple.CoreSimulator.SimRuntime.iOS-18-0': [
      { name: 'e07-smoke', udid: 'OLD', state: 'Shutdown', isAvailable: true },
    ],
  },
};

describe('simulatorName', () => {
  it('prefixes the purpose', () => {
    expect(simulatorName('smoke')).toBe('e07-smoke');
  });

  it('rejects a purpose that is not kebab-case', () => {
    expect(() => simulatorName('My Phone')).toThrow('must be kebab-case');
  });
});

describe('findSimulator', () => {
  it('finds the device by name on the pinned runtime only', () => {
    expect(findSimulator(LIST, 'e07-smoke', IOS_RUNTIME)?.udid).toBe('BBB');
  });

  it('returns undefined for an unknown name', () => {
    expect(findSimulator(LIST, 'e07-e2e', IOS_RUNTIME)).toBeUndefined();
  });
});

describe('ensureSimulator', () => {
  it('reuses an existing simulator without creating one', () => {
    const calls: string[][] = [];
    const simctl = (args: readonly string[]): string => {
      calls.push([...args]);
      return JSON.stringify(LIST);
    };
    expect(ensureSimulator(simctl, 'smoke', 'iPhone 17 Pro Max')).toBe('BBB');
    expect(calls).toStrictEqual([['list', 'devices', '--json']]);
  });

  it('creates, warms up and shuts down a missing simulator', () => {
    const calls: string[][] = [];
    const simctl = (args: readonly string[]): string => {
      calls.push([...args]);
      return args[0] === 'list' ? JSON.stringify(LIST) : 'NEW-UDID\n';
    };
    expect(ensureSimulator(simctl, 'e2e', 'iPhone 17 Pro Max')).toBe('NEW-UDID');
    expect(calls[1]).toStrictEqual(['create', 'e07-e2e', 'iPhone 17 Pro Max', IOS_RUNTIME]);
    expect(calls.at(-1)).toStrictEqual(['shutdown', 'NEW-UDID']);
  });
});

describe('statusBarArgs', () => {
  it('pins the time to 9:41 for the given device', () => {
    expect(statusBarArgs('BBB').slice(0, 5)).toStrictEqual([
      'status_bar',
      'BBB',
      'override',
      '--time',
      '9:41',
    ]);
  });
});

describe('deleteOwnSimulator', () => {
  it('refuses to delete a simulator it did not create', () => {
    const device = { name: 'iPhone 16 Pro Max', udid: 'X', state: 'Shutdown' };
    expect(() => {
      deleteOwnSimulator(() => '', device);
    }).toThrow('refusing to delete');
  });
});
