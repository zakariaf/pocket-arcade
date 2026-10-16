// packages/tooling/src/e2e/android-socket-sampler.test.ts
import fc from 'fast-check';

import {
  appConnections,
  appUidOf,
  decodeHexAddress,
  parseProcNet,
  pidOf,
} from './android-socket-sampler.ts';

const UID = 10_190;
const TCP_HEADER =
  '  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode';
const TCP6_HEADER =
  '  sl  local_address                         remote_address                        st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode';
const UDP_HEADER = `${TCP_HEADER} ref pointer drops`;
const TAIL = '00000000:00000000 00:00000000 00000000';

/** One /proc/net row: local, remote, state, uid (the kernel's column order). */
const row = ([local, remote, state]: readonly [string, string, string], uid: number): string =>
  `   0: ${local} ${remote} ${state} ${TAIL} ${String(uid)}        0 54321 1 0000000000000000 20 4 30 10 -1`;

/** What `for f in tcp tcp6 udp udp6; do echo "## $f"; cat /proc/net/$f; done` prints. */
const SAMPLE = [
  '## tcp',
  TCP_HEADER,
  row(['0100007F:1F90', '00000000:0000', '0A'], UID), // listening on 127.0.0.1:8080
  row(['0100007F:C350', '0100007F:1F90', '01'], UID), // a loopback connection
  row(['0F02000A:C351', '08080808:0035', '01'], 10_050), // another app's socket
  '## tcp6',
  TCP6_HEADER,
  row(
    ['0000000000000000FFFF00000F02000A:A8F2', '0000000000000000FFFF00000EB4FA8E:01BB', '01'],
    UID,
  ),
  row(
    ['00000000000000000000000001000000:1F91', '00000000000000000000000000000000:0000', '0A'],
    UID,
  ),
  '## udp',
  UDP_HEADER,
  row(['0F02000A:D431', '0EB4FA8E:01BB', '01'], UID), // QUIC to Google
  row(['00000000:14E9', '00000000:0000', '07'], UID), // unconnected
  '## udp6',
  UDP_HEADER,
  '',
].join('\n');

describe('decodeHexAddress', () => {
  it('reads the kernel little-endian IPv4 word', () => {
    expect(decodeHexAddress('0100007F')).toBe('127.0.0.1');
    expect(decodeHexAddress('0F02000A')).toBe('10.0.2.15');
  });

  it('reads IPv6, loopback and IPv4-mapped addresses', () => {
    expect(decodeHexAddress('00000000000000000000000001000000')).toBe('::1');
    expect(decodeHexAddress('00000000000000000000000000000000')).toBe('::');
    expect(decodeHexAddress('0000000000000000FFFF00000EB4FA8E')).toBe('::ffff:142.250.180.14');
    expect(decodeHexAddress('B80D0120000000000000000001000000')).toBe('2001:db8::1');
  });

  it('reads back any IPv4 address written the way the kernel writes it', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 4, maxLength: 4 }),
        (bytes) => {
          const hex = [...bytes]
            .reverse()
            .map((byte) => byte.toString(16).padStart(2, '0').toUpperCase())
            .join('');
          return decodeHexAddress(hex) === bytes.join('.');
        },
      ),
    );
  });
});

describe('appConnections', () => {
  it("keeps the app's non-loopback connections only, TCP and UDP (pinned)", () => {
    expect(appConnections(parseProcNet(SAMPLE), UID)).toStrictEqual([
      'tcp6 uid 10190 ESTABLISHED [::ffff:10.0.2.15]:43250 -> [::ffff:142.250.180.14]:443',
      'udp uid 10190 ESTABLISHED 10.0.2.15:54321 -> 142.250.180.14:443',
    ]);
  });

  it('keeps no socket whose peer is loopback, whatever its state', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 255 }),
        fc.constantFrom('01', '06', '08'),
        (last, state) => {
          const peer = `${last.toString(16).padStart(2, '0').toUpperCase()}00007F:1F90`;
          const text = ['## tcp', TCP_HEADER, row(['0100007F:C350', peer, state], UID)].join('\n');
          return appConnections(parseProcNet(text), UID).length === 0;
        },
      ),
    );
  });

  it('keeps nothing when the app has no socket', () => {
    expect(appConnections(parseProcNet(SAMPLE), 10_999)).toStrictEqual([]);
  });
});

describe('parseProcNet', () => {
  it('reads every row of the four tables with its family', () => {
    expect(parseProcNet(SAMPLE).map((socket) => socket.family)).toStrictEqual([
      'tcp',
      'tcp',
      'tcp',
      'tcp6',
      'tcp6',
      'udp',
      'udp',
    ]);
  });
});

describe('appUidOf', () => {
  it('reads the uid of exactly this package', () => {
    const output = [
      'package:io.applander.linesiegebeta uid:10200',
      'package:io.applander.linesiege uid:10190',
    ].join('\n');
    expect(appUidOf(output, 'io.applander.linesiege')).toBe(UID);
  });

  it('is null when the package is not installed', () => {
    expect(appUidOf('', 'io.applander.linesiege')).toBeNull();
  });
});

describe('pidOf', () => {
  it('reads the first pid pidof prints, or null when the app is not running', () => {
    expect(pidOf('4321\n')).toBe('4321');
    expect(pidOf('')).toBeNull();
  });
});
