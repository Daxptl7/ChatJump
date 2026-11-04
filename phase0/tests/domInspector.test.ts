import { describe, expect, it, vi } from 'vitest';
import { inspectDOM, printDiagnostics } from '../src/domInspector';
import { fixture } from './fixtures';

describe('sanitized DOM diagnostics', () => {
  it('reports structure while excluding text, identifiers, labels, URLs, and custom roles', () => {
    const { root } = fixture();
    root.innerHTML = '<article role="listitem" aria-label="PRIVATE PERSON" id="PRIVATE ID"><a href="https://instagram.com/direct/t/PRIVATE">PRIVATE BODY TOKEN</a><time datetime="2026-11-04"></time><div role="PRIVATE ROLE"></div></article>';
    const summary = inspectDOM(root); const serialized = JSON.stringify(summary);
    expect(summary).toMatchObject({ timeElements: 1, datetimeAttributes: 1, accessibleLabelsPresent: 1, roles: { listitem: 1, other: 1 } });
    expect(serialized).not.toMatch(/PRIVATE|instagram|2026-11-04/);
  });
  it('bounds traversal and flags truncated summaries', () => {
    const { root } = fixture(); expect(inspectDOM(root, 1)).toMatchObject({ inspectedElements: 1, truncated: true });
  });
  it('counts SVG elements toward the traversal budget', () => {
    const { root } = fixture([]); root.innerHTML = '<svg><g><path></path></g></svg>';
    expect(inspectDOM(root, 2)).toMatchObject({ inspectedElements: 2, truncated: true });
  });
  it('prints only the same structured summary', () => {
    const { root } = fixture(); const log = vi.spyOn(console, 'info').mockImplementation(() => {});
    const summary = printDiagnostics(root); expect(log).toHaveBeenCalledWith('ChatJump structural diagnostic', summary);
  });
});
