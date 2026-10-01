// packages/tooling/src/audit/network-runtime-layer.test.ts
import { appProcessPattern, nonLoopbackConnections, pidsOf } from './network-runtime-layer.ts';

const HEADER = 'COMMAND   PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME';

describe('nonLoopbackConnections', () => {
  it('keeps only connections whose peer is not loopback', () => {
    const output = [
      HEADER,
      'LineSiege 4242 me   12u  IPv4 0x1      0t0  TCP 127.0.0.1:50000->127.0.0.1:8081 (ESTABLISHED)',
      'LineSiege 4242 me   13u  IPv6 0x2      0t0  TCP [::1]:50001->[::1]:8081 (ESTABLISHED)',
      'LineSiege 4242 me   14u  IPv4 0x3      0t0  TCP 192.168.1.20:50002->142.250.74.46:443 (ESTABLISHED)',
      'LineSiege 4242 me   15u  IPv4 0x4      0t0  UDP *:5353',
    ].join('\n');

    expect(nonLoopbackConnections(output)).toStrictEqual([
      'LineSiege 4242 me   14u  IPv4 0x3      0t0  TCP 192.168.1.20:50002->142.250.74.46:443 (ESTABLISHED)',
    ]);
  });

  it('returns nothing for a process without connected sockets', () => {
    expect(nonLoopbackConnections(`${HEADER}\n`)).toStrictEqual([]);
  });
});

describe('pidsOf', () => {
  it('keeps every pid pgrep printed, so each running copy of the app is sampled', () => {
    expect(pidsOf('4242\n5151\n')).toStrictEqual(['4242', '5151']);
    expect(pidsOf('')).toStrictEqual([]);
  });
});

describe('appProcessPattern', () => {
  const bundle =
    '~/Library/Developer/CoreSimulator/Devices/U1/data/Containers/Bundle/Application/A';
  const matches = (pattern: string, command: string): boolean => new RegExp(pattern).test(command);

  it("finds the app in any bundle folder, Maestro's clearState reinstall included", () => {
    const pattern = appProcessPattern('LineSiege');
    expect(matches(pattern, `${bundle}/LineSiege.app/LineSiege`)).toBe(true);
    expect(matches(pattern, `${bundle}/io.applander.linesiege-1790732416578.app/LineSiege`)).toBe(
      true,
    );
    expect(matches(pattern, `${bundle}/LineSiege.app/LineSiege -AppleLanguages (fa)`)).toBe(true);
    expect(matches(pattern, `${bundle}/LineSiege.app/LineSiegeHelper`)).toBe(false);
  });

  it("keeps to one simulator's copy when given its udid", () => {
    const pattern = appProcessPattern('LineSiege', 'U1');
    expect(matches(pattern, `${bundle}/io.applander.linesiege-1.app/LineSiege`)).toBe(true);
    expect(matches(pattern, `${bundle.replace('U1', 'U2')}/LineSiege.app/LineSiege`)).toBe(false);
  });
});
