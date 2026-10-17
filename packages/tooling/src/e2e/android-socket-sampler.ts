// packages/tooling/src/e2e/android-socket-sampler.ts
// Layer F on Android, pure: the sampler (sample-sockets-android.ts) reads the emulator's four socket
// tables once a second through adb (procNetArgs: /proc/net/tcp, tcp6, udp and udp6, each after a
// "## <table>" marker) and keeps the sockets of the app's uid whose peer is neither loopback nor
// unspecified: a listening or unconnected socket has the peer 0, so only real connections remain.
// The kernel writes each address as hex 32-bit words in host (little-endian) byte order.

export type ProcNetFamily = 'tcp' | 'tcp6' | 'udp' | 'udp6';

export type ProcNetSocket = {
  readonly family: ProcNetFamily;
  /** ip:port, IPv6 in brackets: [::ffff:10.0.2.15]:43250 */
  readonly local: string;
  readonly remote: string;
  readonly remoteIp: string;
  /** The kernel's state name (ESTABLISHED, LISTEN, ...). */
  readonly state: string;
  readonly uid: number;
};

const FAMILIES: readonly ProcNetFamily[] = ['tcp', 'tcp6', 'udp', 'udp6'];
const STATES: Readonly<Record<string, string>> = {
  '01': 'ESTABLISHED',
  '02': 'SYN_SENT',
  '03': 'SYN_RECV',
  '04': 'FIN_WAIT1',
  '05': 'FIN_WAIT2',
  '06': 'TIME_WAIT',
  '07': 'CLOSE',
  '08': 'CLOSE_WAIT',
  '09': 'LAST_ACK',
  '0A': 'LISTEN',
  '0B': 'CLOSING',
};
const ROW =
  /^\s*\d+:\s+([0-9A-F]+):([0-9A-F]{4})\s+([0-9A-F]+):([0-9A-F]{4})\s+([0-9A-F]{2})\s+\S+\s+\S+\s+\S+\s+(\d+)/i;

/** The bytes of one little-endian 32-bit word written as 8 hex digits, in network order. */
function wordBytes(hex: string): number[] {
  const bytes = [0, 2, 4, 6].map((at) => Number.parseInt(hex.slice(at, at + 2), 16));
  return bytes.reverse();
}

function ipv6Text(bytes: readonly number[]): string {
  const isMapped =
    bytes.slice(0, 10).every((byte) => byte === 0) && bytes[10] === 255 && bytes[11] === 255;
  if (isMapped) return `::ffff:${bytes.slice(12).join('.')}`;
  const groups = [0, 2, 4, 6, 8, 10, 12, 14].map((at) =>
    (((bytes[at] ?? 0) << 8) | (bytes[at + 1] ?? 0)).toString(16),
  );
  // The longest run of two or more zero groups becomes "::" (RFC 5952).
  const joined = `:${groups.join(':')}:`;
  const runs = joined.match(/(?::0)+:/g) ?? [];
  const longest = runs.reduce((best, run) => (run.length > best.length ? run : best), '');
  if (longest.length < ':0:0:'.length) return groups.join(':');
  return joined
    .replace(longest, '::')
    .replace(/^:(?!:)/, '')
    .replace(/(?<!:):$/, '');
}

/** One kernel address (8 hex digits for IPv4, 32 for IPv6) as text. */
export function decodeHexAddress(hex: string): string {
  if (hex.length === 8) return wordBytes(hex).join('.');
  const bytes = [0, 8, 16, 24].flatMap((at) => wordBytes(hex.slice(at, at + 8)));
  return ipv6Text(bytes);
}

const withPort = (ip: string, portHex: string): string =>
  `${ip.includes(':') ? `[${ip}]` : ip}:${String(Number.parseInt(portHex, 16))}`;

function socketOf(family: ProcNetFamily, line: string): ProcNetSocket | null {
  const match = ROW.exec(line);
  if (match === null) return null;
  const [, localIp = '', localPort = '', remoteHex = '', remotePort = '', state = '', uid = ''] =
    match;
  const remoteIp = decodeHexAddress(remoteHex);
  return {
    family,
    local: withPort(decodeHexAddress(localIp), localPort),
    remote: withPort(remoteIp, remotePort),
    remoteIp,
    state: STATES[state.toUpperCase()] ?? state,
    uid: Number(uid),
  };
}

/** Every row of the marked tables that procNetArgs prints. */
export function parseProcNet(text: string): ProcNetSocket[] {
  const sockets: ProcNetSocket[] = [];
  let family: ProcNetFamily | null = null;
  for (const line of text.split('\n')) {
    const marker = /^## (\w+)$/.exec(line.trim())?.[1];
    if (marker !== undefined) {
      family = FAMILIES.find((name) => name === marker) ?? null;
      continue;
    }
    const socket = family === null ? null : socketOf(family, line);
    if (socket !== null) sockets.push(socket);
  }
  return sockets;
}

/** Loopback (127.0.0.0/8, ::1) or unspecified (no peer: listening or unconnected). */
function isLocalOnly(ip: string): boolean {
  const v4 = ip.startsWith('::ffff:') ? ip.slice('::ffff:'.length) : ip;
  return v4.startsWith('127.') || v4 === '0.0.0.0' || ip === '::1' || ip === '::';
}

/** The lines network.txt gets: the app's connections to anything but this device. */
export function appConnections(sockets: readonly ProcNetSocket[], uid: number): string[] {
  return sockets
    .filter((socket) => socket.uid === uid && !isLocalOnly(socket.remoteIp))
    .map(({ family, state, local, remote }) =>
      [family, 'uid', String(uid), state, local, '->', remote].join(' '),
    );
}

/** The uid of exactly `packageName` in `cmd package list packages -U` output, or null. */
export function appUidOf(output: string, packageName: string): number | null {
  for (const line of output.split('\n')) {
    const match = /^package:(\S+)\s+uid:(\d+)/.exec(line.trim());
    if (match?.[1] === packageName) return Number(match[2]);
  }
  return null;
}

/** The first pid `pidof` prints, or null when the app is not running. */
export function pidOf(output: string): string | null {
  return /^\d+/.exec(output.trim())?.[0] ?? null;
}
