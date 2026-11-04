export interface DOMDiagnostic {
  inspectedElements: number;
  truncated: boolean;
  roles: Record<string, number>;
  timeElements: number;
  datetimeAttributes: number;
  accessibleLabelsPresent: number;
  scrollCandidates: Array<{ ordinal: number; scrollTop: number; scrollHeight: number; clientHeight: number; overflowY: string; flexDirection: string }>;
}

/** Structural summary only. No attribute values other than allowlisted roles/styles, no text/URLs/IDs. */
export function inspectDOM(root: HTMLElement, limit = 2000): DOMDiagnostic {
  const max = Math.min(10_000, Math.max(1, Math.floor(limit) || 2000));
  const output: DOMDiagnostic = { inspectedElements: 0, truncated: false, roles: {}, timeElements: 0, datetimeAttributes: 0, accessibleLabelsPresent: 0, scrollCandidates: [] };
  const roles = new Set(['main', 'region', 'list', 'listitem', 'row', 'grid', 'log', 'button', 'textbox', 'heading', 'dialog', 'navigation']);
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let node: Node | null = root;
  while (node && output.inspectedElements < max) {
    const ordinal = output.inspectedElements++;
    if (node instanceof HTMLElement) {
      const role = node.getAttribute('role');
      if (role) { const safe = roles.has(role) ? role : 'other'; output.roles[safe] = (output.roles[safe] ?? 0) + 1; }
      if (node.tagName === 'TIME') output.timeElements++;
      if (node.hasAttribute('datetime')) output.datetimeAttributes++;
      if (node.hasAttribute('aria-label')) output.accessibleLabelsPresent++;
      if (node.clientHeight > 0 && node.scrollHeight > node.clientHeight && output.scrollCandidates.length < 50) {
        const style = root.ownerDocument.defaultView?.getComputedStyle(node);
        output.scrollCandidates.push({ ordinal, scrollTop: node.scrollTop, scrollHeight: node.scrollHeight, clientHeight: node.clientHeight,
          overflowY: ['auto', 'scroll', 'hidden', 'visible', 'clip', 'overlay'].includes(style?.overflowY ?? '') ? style!.overflowY : 'other',
          flexDirection: ['row', 'row-reverse', 'column', 'column-reverse'].includes(style?.flexDirection ?? '') ? style!.flexDirection : 'other' });
      }
    }
    node = walker.nextNode();
  }
  output.truncated = node !== null;
  return output;
}

export function printDiagnostics(root: HTMLElement): DOMDiagnostic {
  const summary = inspectDOM(root);
  console.info('ChatJump structural diagnostic', summary);
  return summary;
}
