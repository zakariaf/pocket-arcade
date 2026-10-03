// packages/shell/src/testing/find-inaccessible-pressables.ts
import type { TestInstance, TestNode } from 'test-renderer';

function isPressable(node: TestInstance): boolean {
  return typeof node.props['onClick'] === 'function' || typeof node.props['onPress'] === 'function';
}

function hasText(node: TestNode): boolean {
  if (typeof node === 'string') return node.trim() !== '';
  return node.children.some(hasText);
}

function describeNode(node: TestInstance): string {
  const testId: unknown = node.props['testID'];
  return typeof testId === 'string' ? testId : `<${node.type}>`;
}

/**
 * Every pressable host element needs a role and a name (label or visible text).
 * Use at the end of every screen test:
 *   expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
 */
export function findInaccessiblePressables(root: TestInstance): readonly string[] {
  return root.queryAll(isPressable).flatMap((node) => {
    const role: unknown = node.props['accessibilityRole'] ?? node.props['role'];
    const label: unknown = node.props['accessibilityLabel'];
    const problems: string[] = [];
    if (typeof role !== 'string') problems.push(`${describeNode(node)}: no role`);
    if (!(typeof label === 'string' && label !== '') && !hasText(node)) {
      problems.push(`${describeNode(node)}: no accessible name`);
    }
    return problems;
  });
}
