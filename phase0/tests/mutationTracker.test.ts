import { describe, expect, it } from 'vitest';
import { MutationTracker } from '../src/mutationTracker';
import { fixture } from './fixtures';

describe('scoped mutation tracking', () => {
  it('separates DOM insertions, element observations, and stable message keys', () => {
    const { root, adapter, add } = fixture(); adapter.messageKey = (message) => message.dataset.message;
    const tracker = new MutationTracker(root, root, adapter);
    tracker.observeMessages(adapter.getMessages(root));
    const message = add('2026-11-03'); tracker.observeMessages(adapter.getMessages(root)); tracker.observeMessages([message]);
    expect(tracker.snapshot()).toMatchObject({ addedElements: 1, messageElementsObserved: 2, uniqueMessagesObserved: 2 });
    tracker.disconnect();
  });
  it('omits unique counts without a verified stable key', () => {
    const { root, adapter } = fixture(); const tracker = new MutationTracker(root, root, adapter);
    tracker.observeMessages(adapter.getMessages(root)); expect(tracker.snapshot()).not.toHaveProperty('uniqueMessagesObserved'); tracker.disconnect();
  });
  it('omits unique counts if any observed key is unavailable', () => {
    const { root, adapter, add } = fixture(); adapter.messageKey = (message) => message.dataset.message;
    const tracker = new MutationTracker(root, root, adapter); tracker.observeMessages(adapter.getMessages(root));
    const message = add('2026-11-03'); delete message.dataset.message;
    tracker.observeMessages([message]); expect(tracker.snapshot()).not.toHaveProperty('uniqueMessagesObserved'); tracker.disconnect();
  });
  it('counts a changed stable key on a reused DOM node', () => {
    const { root, adapter } = fixture(); adapter.messageKey = (message) => message.dataset.message;
    const tracker = new MutationTracker(root, root, adapter); const messages = adapter.getMessages(root);
    tracker.observeMessages(messages); messages[0]!.dataset.message = 'new-message'; tracker.observeMessages(messages);
    expect(tracker.snapshot()).toMatchObject({ messageElementsObserved: 1, uniqueMessagesObserved: 2 }); tracker.disconnect();
  });
  it('ignores outside mutations, flushes pending records, and stops after disconnect', async () => {
    const { root, adapter, add } = fixture(); const tracker = new MutationTracker(root, root, adapter);
    document.body.append(document.createElement('aside')); await Promise.resolve();
    expect(tracker.snapshot().mutationEvents).toBe(0);
    add('2026-11-03'); expect(tracker.snapshot().mutationEvents).toBeGreaterThan(0);
    const count = tracker.snapshot().mutationEvents; tracker.disconnect(); add('2026-11-02'); await Promise.resolve();
    expect(tracker.snapshot().mutationEvents).toBe(count);
  });
  it('suspects virtualization only when known message elements are removed', () => {
    const { root, adapter } = fixture(); const decoration = document.createElement('span'); root.append(decoration);
    const tracker = new MutationTracker(root, root, adapter); tracker.observeMessages(adapter.getMessages(root)); decoration.remove();
    expect(tracker.snapshot().virtualizationSuspected).toBe(false);
    root.querySelector('article')!.remove(); expect(tracker.snapshot().virtualizationSuspected).toBe(true); tracker.disconnect();
  });
  it('detects timestamp attribute changes and scroll height changes without reading text', () => {
    const { root, adapter } = fixture(); const tracker = new MutationTracker(root, root, adapter);
    root.querySelector('time')!.dateTime = '2026-11-03'; Object.defineProperty(root, 'scrollHeight', { get: () => 1500 });
    expect(tracker.snapshot()).toMatchObject({ scrollHeightChanges: 1, mutationEvents: 1 }); tracker.disconnect();
  });
});
