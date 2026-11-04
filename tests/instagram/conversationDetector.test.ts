import { describe, expect, it } from 'vitest';
import { detectConversation } from '../../src/adapters/instagram/conversationDetector';
import { fixture } from './fixtures';

describe('Phase 2 conversation structure', () => {
  it('requires a verified root/list/identity, not a DM route alone', () => {
    const { config, root, list } = fixture();
    expect(detectConversation(document, config)).toMatchObject({ status: 'detected', conversationElement: root, messageList: list, confidence: 'high' });
    expect(detectConversation(document, { verification: 'unverified' })).toMatchObject({ status: 'unsupported-layout', reason: 'UNVERIFIED_SELECTORS' });
  });
  it.each(['/', '/direct/inbox/', '/direct/t/'])('classifies %s as no selected conversation', (path) => {
    const { config } = fixture(); history.replaceState({}, '', path);
    expect(detectConversation(document, config)).toMatchObject({ status: 'not-open', reason: 'NO_CONVERSATION' });
  });
  it('rejects inbox-like markup without a message list or identity', () => {
    const { config, root, list } = fixture(); list.remove();
    expect(detectConversation(document, config).status).toBe('unsupported-layout');
    root.removeAttribute('data-test-key'); expect(detectConversation(document, config).status).toBe('unsupported-layout');
  });
  it('rejects missing, hidden, document-wide, and ambiguous roots', () => {
    const { config, root } = fixture(); root.hidden = true; expect(detectConversation(document, config).status).toBe('unsupported-layout');
    root.hidden = false; document.body.append(root.cloneNode(true)); expect(detectConversation(document, config).status).toBe('unsupported-layout');
    config.conversationSelectors = ['body']; expect(detectConversation(document, config).status).toBe('unsupported-layout');
    config.conversationSelectors = ['[data-missing]']; expect(detectConversation(document, config).reason).toBe('MESSAGE_CONTAINER_NOT_FOUND');
  });
  it('supports an explicitly reviewed fallback and narrow transition region', () => {
    const { config } = fixture(); config.conversationSelectors = ['[data-missing]', '[data-test-conversation]']; config.transitionRootSelector = 'main';
    expect(detectConversation(document, config).status).toBe('detected');
    config.transitionRootSelector = 'body'; expect(detectConversation(document, config).status).toBe('unsupported-layout');
  });
  it('sanitizes bad selector failures', () => {
    const { config } = fixture(); config.conversationSelectors = ['PRIVATE ['];
    expect(detectConversation(document, config)).toMatchObject({ status: 'error', reason: 'ADAPTER_FAILED' });
  });
  it('recognizes same-root conversation key changes', () => {
    const { config, root } = fixture(); const first = detectConversation(document, config); root.setAttribute('data-test-key', 'next-opaque-fixture');
    expect(detectConversation(document, config).identity).not.toBe(first.identity);
  });
});
