import type { ConversationSnapshot, ConversationState, MessageReference } from './messageTypes';

export interface ChatAdapter {
  isSupportedPage(): boolean;
  detectConversation(): ConversationState;
  getRenderedMessages(): MessageReference[];
  getScrollContainer(): HTMLElement | null;
  getSnapshot(): ConversationSnapshot;
  observeMessages(callback: (snapshot: ConversationSnapshot) => void): () => void;
  cleanup(): void;
}
