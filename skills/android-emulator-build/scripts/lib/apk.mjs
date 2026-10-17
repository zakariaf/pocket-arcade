// apk.mjs: the two aapt2 dumps check-emu-app reads from a built APK (`aapt2 dump badging` and `aapt2 dump xmltree --file AndroidManifest.xml`).
// The APK's AndroidManifest.xml is binary XML; aapt2 (in the pinned build-tools) prints it as text,
// so the checker never parses binary XML itself. Formats verified on 2026-10-12 against a real
// release APK dumped with build-tools 36.0.0's aapt2. The zip itself is read by the shared zip.mjs,
// and the manifest tree is queried with the shared manifest-tree.mjs.

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

