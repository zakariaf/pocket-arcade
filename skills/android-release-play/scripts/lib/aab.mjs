// aab.mjs: reads an Android App Bundle without any package or tool. An AAB is a zip: the JS bundle
// is base/assets/index.android.bundle, expo-constants' config base/assets/app.config, and the
// manifest base/manifest/AndroidManifest.xml in aapt2's protobuf format (Resources.proto XmlNode:
// element = 1; XmlElement name = 3, attribute = 4, child = 5; XmlAttribute name = 2, value = 3,
// compiled_item = 6 with Primitive = 7). The jar signature sits in META-INF/*.RSA|EC|DSA.
// Verified on 2026-10-12 against a real release AAB built with AGP 8.
import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

/** The entries of a zip file: name -> { method, local, compressedSize }. */
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

/** One entry's bytes, or null when the zip has no such entry (stored or deflated). */
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

/** Protobuf wire fields of a message: [{ no, value (varint) | bytes }]. */
function fields(buffer) {
  const out = [];
  let i = 0;
  const varint = () => {
    let result = 0n;
    let shift = 0n;
    for (;;) {
      const byte = buffer[i];
      i += 1;
      result |= BigInt(byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) return result;
      shift += 7n;
    }
  };
  while (i < buffer.length) {
    const key = Number(varint());
    const no = key >> 3;
    const wire = key & 7;
    if (wire === 0) out.push({ no, value: varint() });
    else if (wire === 2) {
      const length = Number(varint());
      out.push({ no, bytes: buffer.subarray(i, i + length) });
      i += length;
    } else if (wire === 5) i += 4;
    else if (wire === 1) i += 8;
    else throw new Error(`unsupported protobuf wire type ${wire}`);
  }
  return out;
}

/** An attribute's value: its string, else its compiled primitive (boolean or integer). */
function attributeValue(attribute) {
  const text = attribute.find((field) => field.no === 3)?.bytes?.toString('utf8') ?? '';
  if (text !== '') return text;
  const item = attribute.find((field) => field.no === 6);
  const primitive = item ? fields(item.bytes).find((field) => field.no === 7) : undefined;
  const value = primitive ? fields(primitive.bytes)[0] : undefined;
  if (value === undefined) return '';
  return value.no === 8 ? String(value.value === 1n) : String(value.value ?? '');
}

/** The protobuf manifest -> { name, attributes, children } (attribute names without namespace). */
export function parseProtoXml(buffer) {
  const element = fields(buffer).find((field) => field.no === 1);
  if (element === undefined) return null;
  const node = { name: '', attributes: {}, children: [] };
  for (const field of fields(element.bytes)) {
    if (field.no === 3) node.name = field.bytes.toString('utf8');
    else if (field.no === 4) {
      const attribute = fields(field.bytes);
      const name = attribute.find((part) => part.no === 2)?.bytes?.toString('utf8');
      if (name) node.attributes[name] = attributeValue(attribute);
    } else if (field.no === 5) {
      const child = parseProtoXml(field.bytes);
      if (child !== null) node.children.push(child);
    }
  }
  return node;
}

/** Every element called `name` at or below `node`. */
export function findElements(node, name) {
  const found = node.name === name ? [node] : [];
  for (const child of node.children) found.push(...findElements(child, name));
  return found;
}

/** <meta-data android:name="<name>"> under <application>: its value, or null. */
export function metaDataValue(manifest, name) {
  const application = findElements(manifest, 'application')[0];
  const entry = application?.children.find((child) => child.name === 'meta-data' && child.attributes.name === name);
  return entry?.attributes.value ?? null;
}

/**
 * The jar signature of the bundle: { isSigned, isDebugKey }. The signature block holds the
 * signer's certificate, whose subject names "Android Debug" for the debug keystore.
 */
export function signatureOf(zip) {
  const blocks = [...zip.entries.keys()].filter((name) => /^META-INF\/[^/]+\.(RSA|EC|DSA)$/i.test(name));
  if (blocks.length === 0) return { isSigned: false, isDebugKey: false };
  const isDebugKey = blocks.some((name) => readZipEntry(zip, name).toString('latin1').includes('Android Debug'));
  return { isSigned: true, isDebugKey };
}
