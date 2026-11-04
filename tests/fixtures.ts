import { vi } from 'vitest';
import type { BrowserClient } from '../src/types/extension';
export const response = { success: true, platform: 'instagram', contentScriptReady: true, conversationDetected: null } as const;
export function testClient() {
  const listeners = new Set<() => void>();
  const unsubscribe = vi.fn();
  const client = {
    queryActiveTab: vi.fn<BrowserClient['queryActiveTab']>(async () => ({ id: 7, url: 'https://www.instagram.com/direct/t/synthetic/', status: 'complete' })),
    sendMessage: vi.fn<BrowserClient['sendMessage']>(async () => response),
    subscribe: vi.fn((callback: () => void) => { listeners.add(callback); return () => { listeners.delete(callback); unsubscribe(); }; }),
  };
  return { client, emit: () => listeners.forEach((callback) => callback()), unsubscribe };
}
