// zip.mjs: reads zip files (APKs and AABs alike) without any package: the central directory, and an
// entry's bytes through node:zlib (stored and deflated entries only, what Gradle and bundletool write).
// A helper, not an entry point. Shared by android-emulator-build (check-emu-app, the APK) and
// android-release-play (check-store-aab, the AAB); each keeps only its own format parsers.
// Formats verified on 2026-10-12 against a real release APK and AAB built with AGP 8.
import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

/** The entries of a zip file: { buffer (the whole file), entries: name -> { method, local, compressedSize } }. */
export function readZipIndex(path) {
  const buffer = readFileSync(path);
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 0xffff - 22); i -= 1) {
    if (buffer.readUInt32LE(i) === EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error(`${path} is not a zip file (no end-of-central-directory record)`);
  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries = new Map();
  for (let index = 0; index < count; index += 1) {
    if (buffer.readUInt32LE(offset) !== CENTRAL) throw new Error(`${path}: broken central directory at entry ${index}`);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
    entries.set(name, { method: buffer.readUInt16LE(offset + 10), compressedSize: buffer.readUInt32LE(offset + 20), local: buffer.readUInt32LE(offset + 42) });
    offset += 46 + nameLength + buffer.readUInt16LE(offset + 30) + buffer.readUInt16LE(offset + 32);
  }
  return { buffer, entries };
}

/** One entry's bytes, or null when the zip has no such entry. Stored (0) and deflated (8) entries only. */
export function readZipEntry(zip, name) {
  const entry = zip.entries.get(name);
  if (entry === undefined) return null;
  const { buffer } = zip;
  if (buffer.readUInt32LE(entry.local) !== LOCAL) throw new Error(`broken local header for ${name}`);
  const start = entry.local + 30 + buffer.readUInt16LE(entry.local + 26) + buffer.readUInt16LE(entry.local + 28);
  const data = buffer.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) return Buffer.from(data);
  if (entry.method === 8) return inflateRawSync(data);
  throw new Error(`${name} uses zip method ${entry.method}; only stored (0) and deflate (8) are read`);
}
