// manifest-tree.mjs: queries an AndroidManifest.xml tree of { name, attributes, children } (attribute
// names without their namespace), whichever parser built it: android-emulator-build's parseXmlTree
// (aapt2's xmltree text of an APK, under a "#root" node) or android-release-play's parseProtoXml (the
// AAB's protobuf manifest, rooted at <manifest> itself). A helper, not an entry point.
//
// findElements searches at or below the node it is given: the AAB tree's root is <manifest>, so
// findElements(tree, 'manifest') must return the root itself, and the APK tree's "#root" never matches
// an element name. Both self-tests pin this.

/** Every element called `name` at or below `node`, in document order. */
export function findElements(node, name) {
  const found = node.name === name ? [node] : [];
  for (const child of node.children) found.push(...findElements(child, name));
  return found;
}

/** The value of the <meta-data android:name="<name>"> under <application>, or null. */
export function metaDataValue(tree, name) {
  const application = findElements(tree, 'application')[0];
  const entry = application?.children.find((child) => child.name === 'meta-data' && child.attributes.name === name);
  return entry?.attributes.value ?? null;
}
