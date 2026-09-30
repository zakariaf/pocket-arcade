// packages/tooling/src/audit/network-runtime-layer.test.ts
import { nonLoopbackConnections } from './network-runtime-layer.ts';

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
