import { vi } from 'vitest';
import type { BrowserClient } from '../src/types/extension';
import { emptySnapshot } from '../src/adapters/instagram/InstagramAdapter';
export const response = { success: true, platform: 'instagram', contentScriptReady: true, conversationDetected: null } as const;
export function testClient() {
  const listeners = new Set<() => void>();
  const unsubscribe = vi.fn();
  const client = {
    queryActiveTab: vi.fn<BrowserClient['queryActiveTab']>(async () => ({ id: 7, url: 'https://www.instagram.com/direct/t/synthetic/', status: 'complete' })),
    sendMessage: vi.fn<BrowserClient['sendMessage']>(async (_id, message) => message.type === 'GET_CONVERSATION_STATUS' || message.type === 'GET_RENDERED_MESSAGE_SUMMARY'
      ? { success: true, type: message.type, snapshot: emptySnapshot('unsupported-layout', 'unverified', 'UNVERIFIED_SELECTORS') } : response),
    subscribe: vi.fn((callback: () => void) => { listeners.add(callback); return () => { listeners.delete(callback); unsubscribe(); }; }),
  };
  return { client, emit: () => listeners.forEach((callback) => callback()), unsubscribe };
}
