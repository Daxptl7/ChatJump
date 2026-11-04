import { describe, expect, it, vi } from 'vitest';
import { unverifiedAdapter } from '../src/adapter';
import { detectConversation, isCandidateConversationRoute, isInstagram, sameConversation, watchConversation } from '../src/conversationDetector';
import { fixture } from './fixtures';

describe('conversation detection', () => {
  it.each(['https://www.instagram.com/direct/t/1/', 'https://instagram.com/direct/t/1/'])('accepts the exact HTTPS host %s', (url) => expect(isInstagram(new URL(url))).toBe(true));
  it.each(['http://www.instagram.com/direct/t/1/', 'https://instagram.com.evil.test/direct/t/1/', 'https://evilinstagram.com/', 'https://www.instagram.com:8443/'])('rejects an unsupported host/protocol %s', (url) => expect(isInstagram(new URL(url))).toBe(false));
  it.each(['/direct/inbox/', '/', '/direct/t/', '/direct/t/a/details/'])('rejects non-conversation route %s', (path) => expect(isCandidateConversationRoute(new URL(path, location.href))).toBe(false));
  it('fails safely before any manually verified adapter exists', () => expect(detectConversation(unverifiedAdapter).reason).toBe('adapter-unverified'));
  it('requires a rendered conversation, not just a route', () => {
    const { root, adapter } = fixture(); root.remove();
    expect(detectConversation(adapter).isConversationOpen).toBe(false);
  });
  it('returns a scoped conversation with an in-memory identity', () => {
    const { adapter, root } = fixture();
    expect(detectConversation(adapter)).toMatchObject({ isConversationOpen: true, conversationElement: root, conversationId: 'synthetic-thread' });
  });
  it('rejects document-wide and hidden roots', () => {
    const { adapter, root } = fixture();
    adapter.resolveConversation = () => document.body;
    expect(detectConversation(adapter).isConversationOpen).toBe(false);
    adapter.resolveConversation = () => root; root.hidden = true;
    expect(detectConversation(adapter).isConversationOpen).toBe(false);
  });
  it('requires a switch-aware identity', () => {
    const { adapter } = fixture(); adapter.conversationKey = () => undefined;
    expect(detectConversation(adapter).reason).toBe('conversation-identity-unavailable');
  });
  it('detects same-root key changes and route changes', () => {
    const { adapter, root } = fixture(); const before = detectConversation(adapter);
    root.dataset.key = 'other-thread'; expect(sameConversation(before, detectConversation(adapter))).toBe(false);
    history.replaceState({}, '', '/direct/inbox/'); expect(detectConversation(adapter).isConversationOpen).toBe(false);
  });
  it('watches switches without retaining a timer after cleanup', () => {
    vi.useFakeTimers(); const { adapter, root } = fixture(); const change = vi.fn();
    const stop = watchConversation(adapter, change); root.dataset.key = 'next';
    vi.advanceTimersByTime(200); expect(change).toHaveBeenCalledTimes(1);
    stop(); vi.advanceTimersByTime(1000); expect(change).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0);
  });
  it('sanitizes errors from local adapters', () => {
    const { adapter } = fixture(); adapter.resolveConversation = () => { throw new Error('PRIVATE URL BODY TOKEN'); };
    expect(JSON.stringify(detectConversation(adapter))).not.toContain('PRIVATE');
    expect(detectConversation(adapter).reason).toBe('adapter-failed');
  });
});
