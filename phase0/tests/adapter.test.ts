import { describe, expect, it } from 'vitest';
import { createManualAttributeAdapter } from '../src/adapter';
import { detectConversation } from '../src/conversationDetector';
import { fixture } from './fixtures';

// These selectors are synthetic fixture attributes only, not Instagram selectors.
const config = { verification: 'manual' as const, conversationSelector: 'section[data-key]', conversationKeyAttribute: 'data-key', messageSelector: 'article', scrollSelector: ':scope', olderDirection: 'up' as const, datetimeAssociationVerified: true as const };

describe('manually calibrated attribute adapter', () => {
  it('binds only the explicitly supplied scoped DOM relationships', () => {
    const { root } = fixture(); const adapter = createManualAttributeAdapter(config);
    expect(detectConversation(adapter).isConversationOpen).toBe(true); expect(adapter.getMessages(root)).toHaveLength(1);
    expect(adapter.getTimestampCandidates(adapter.getMessages(root)[0]!, root)[0]?.associationVerified).toBe(true);
    expect(adapter.getScrollEvidence(root)).toMatchObject({ container: root, olderDirection: 'up', directionVerified: true });
    expect(adapter.allHistoryRendered).toBeUndefined(); expect(adapter.messageKey).toBeUndefined();
  });
  it('rejects ambiguity and empty calibration values', () => {
    fixture(); fixture(); const adapter = createManualAttributeAdapter(config);
    expect(detectConversation(adapter).isConversationOpen).toBe(false);
    expect(() => createManualAttributeAdapter({ ...config, messageSelector: '' })).toThrow('manual-verification-required');
  });
  it('does not expose values through malformed-selector errors', () => {
    fixture(); const adapter = createManualAttributeAdapter({ ...config, conversationSelector: 'PRIVATE invalid [' });
    expect(detectConversation(adapter).reason).toBe('adapter-failed');
  });
});
