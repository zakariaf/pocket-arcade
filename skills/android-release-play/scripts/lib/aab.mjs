// aab.mjs: reads an Android App Bundle without any package or tool. An AAB is a zip: the JS bundle
// is base/assets/index.android.bundle, expo-constants' config base/assets/app.config, and the
// manifest base/manifest/AndroidManifest.xml in aapt2's protobuf format (Resources.proto XmlNode:
// element = 1; XmlElement name = 3, attribute = 4, child = 5; XmlAttribute name = 2, value = 3,
// compiled_item = 6 with Primitive = 7). The jar signature sits in META-INF/*.RSA|EC|DSA.
// Verified on 2026-10-12 against a real release AAB built with AGP 8. The zip itself is read by the
// shared zip.mjs, and the manifest tree is queried with the shared manifest-tree.mjs.
import { readZipEntry } from './zip.mjs';

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
