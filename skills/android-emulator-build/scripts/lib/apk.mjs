// apk.mjs: reads a built APK without any package: zip entries through node:zlib, and the two aapt2
// dumps check-emu-app needs (`aapt2 dump badging` and `aapt2 dump xmltree --file AndroidManifest.xml`).
// The APK's AndroidManifest.xml is binary XML; aapt2 (in the pinned build-tools) prints it as text,
// so the checker never parses binary XML itself. Formats verified on 2026-10-12 against a real
// release APK dumped with build-tools 36.0.0's aapt2.
import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

/** The entries of a zip file (APK and AAB alike): name -> { method, offset, compressedSize }. */
export function readZipIndex(path) {
  const buffer = readFileSync(path);
  const from = Math.max(0, buffer.length - 0xffff - 22);
  let eocd = -1;
  for (let i = buffer.length - 22; i >= from; i -= 1) {
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
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const local = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
    entries.set(name, { method, local, compressedSize });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return { buffer, entries };
}

/** One entry's bytes, or null when the zip has no such entry. Stored and deflated entries only. */
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

/** `aapt2 dump badging` text -> { package, versionCode, versionName, minSdk, targetSdk, permissions, isDebuggable }. */
export function parseBadging(text) {
  const pkg = /^package: name='([^']*)' versionCode='([^']*)' versionName='([^']*)'/m.exec(text);
  const minSdk = /^(?:minSdkVersion|sdkVersion):'(\d+)'/m.exec(text);
  const targetSdk = /^targetSdkVersion:'(\d+)'/m.exec(text);
  return {
    package: pkg?.[1] ?? null,
    versionCode: pkg?.[2] ?? null,
    versionName: pkg?.[3] ?? null,
    minSdk: minSdk ? Number(minSdk[1]) : null,
    targetSdk: targetSdk ? Number(targetSdk[1]) : null,
    permissions: [...text.matchAll(/^uses-permission: name='([^']+)'/gm)].map((match) => match[1]),
    isDebuggable: /^application-debuggable\b/m.test(text),
  };
}

/** One attribute line of `aapt2 dump xmltree`: `A: <ns>:<name>(0x..)="value" (Raw: ...)` or `=true`. */
function parseAttribute(line) {
  const match = /^A: (?:(\S+?):)?([\w.]+)(?:\(0x[0-9a-f]+\))?=(.*)$/.exec(line);
  if (!match) return null;
  const raw = match[3];
  const quoted = /^"((?:[^"\\]|\\.)*)"/.exec(raw);
  return { name: match[2], value: quoted ? quoted[1] : raw.trim() };
}

/**
 * `aapt2 dump xmltree --file AndroidManifest.xml` text -> a tree of { name, attributes, children }.
 * Indentation gives the nesting; namespace lines (N:) are skipped.
 */
export function parseXmlTree(text) {
  const root = { name: '#root', attributes: {}, children: [], depth: -1 };
  const stack = [root];
  for (const line of text.split('\n')) {
    const depth = line.length - line.trimStart().length;
    const body = line.trim();
    if (body.startsWith('E: ')) {
      while (stack.length > 1 && stack.at(-1).depth >= depth) stack.pop();
      const element = { name: body.slice(3).split(' ')[0], attributes: {}, children: [], depth };
      stack.at(-1).children.push(element);
      stack.push(element);
    } else if (body.startsWith('A: ')) {
      const attribute = parseAttribute(body);
      if (attribute !== null && stack.length > 1) stack.at(-1).attributes[attribute.name] = attribute.value;
    }
  }
  return root;
}

/** Every element called `name` anywhere below `node`. */
export function findElements(node, name) {
  const found = [];
  for (const child of node.children) {
    if (child.name === name) found.push(child);
    found.push(...findElements(child, name));
  }
  return found;
}

/** The value of the <meta-data android:name="<name>"> under <application>, or null. */
export function metaDataValue(tree, name) {
  const application = findElements(tree, 'application')[0];
  if (application === undefined) return null;
  const entry = application.children.find((child) => child.name === 'meta-data' && child.attributes.name === name);
  return entry?.attributes.value ?? null;
}
