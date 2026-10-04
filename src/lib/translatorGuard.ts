/**
 * Browser translators (Chrome/Google Translate) wrap text nodes in <font>
 * elements behind React's back. When React later removes or inserts next to a
 * node that the translator moved, the DOM throws "Failed to execute
 * 'removeChild' on 'Node'" and the page breaks. PostHog recorded 12 of these
 * on /en in Sept 2026, from visitors reading the English site through
 * Chrome's translation (Russian/Ukrainian browsers, no matching locale).
 *
 * Known workaround (facebook/react#11538): ignore those two calls when the
 * node is no longer where React expects it. Must run before hydration.
 */
export function installTranslatorGuard(): void {
  if (typeof Node !== "function" || !Node.prototype) return;
  const proto = Node.prototype as Node & { __afroGuard?: boolean };
  if (proto.__afroGuard) return;
  proto.__afroGuard = true;

  const originalRemoveChild = proto.removeChild;
  proto.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) {
      return child;
    }
    return originalRemoveChild.call(this, child) as T;
  };

  const originalInsertBefore = proto.insertBefore;
  proto.insertBefore = function <T extends Node>(this: Node, newNode: T, referenceNode: Node | null): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      return newNode;
    }
    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  };
}
