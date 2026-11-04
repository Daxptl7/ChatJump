import { describe, expect, it } from 'vitest';
import { detectMessages } from '../../src/adapters/instagram/messageDetector';
import { fixture } from './fixtures';

describe('currently rendered message references', () => {
  it('deduplicates nested matches and excludes nearby UI', () => {
    const { adapter, list } = fixture(['2026-11-04', '2026-11-03']);
    list.querySelector('article')!.insertAdjacentHTML('beforeend', '<span data-test-message><b>Nested body</b></span>');
    list.insertAdjacentHTML('afterend', '<article data-test-message>Outside list</article>');
    expect(adapter.getRenderedMessages()).toHaveLength(2); expect(new Set(adapter.getRenderedMessages().map((message) => message.localKey)).size).toBe(2);
    adapter.cleanup();
  });
  it('counts media containers without inspecting or extracting media', () => {
    const { adapter, add } = fixture([]); const media = add(null); media.innerHTML = '<img alt="PRIVATE MEDIA" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==">';
    Object.defineProperty(media, 'textContent', { get: () => { throw new Error('Must not read message body'); } });
    expect(adapter.getRenderedMessages()).toMatchObject([{ source: 'unknown', timestampConfidence: 'unknown' }]);
    expect(adapter.getSnapshot()).toMatchObject({ renderedMessageCount: 1, datedMessageCount: 0 }); adapter.cleanup();
  });
  it('distinguishes viewport-visible messages from rendered offscreen messages', () => {
    const { adapter, list } = fixture(['2026-11-04', '2026-11-03']);
    list.querySelectorAll('article')[1]!.getBoundingClientRect = () => ({ top: -100, bottom: -80, left: 0, right: 200, width: 200, height: 20 } as DOMRect);
    expect(adapter.getSnapshot()).toMatchObject({ renderedMessageCount: 2, visibleMessageCount: 1, datedMessageCount: 2 }); adapter.cleanup();
  });
  it('drops disconnected and hidden elements and supports an empty confirmed list', () => {
    const { adapter, list } = fixture(['2026-11-04', '2026-11-03']); list.querySelector('article')!.remove(); (list.querySelector('article') as HTMLElement).hidden = true;
    expect(adapter.getSnapshot()).toMatchObject({ status: 'detected', renderedMessageCount: 0, timestampCoverage: 'unknown', reason: 'NO_RENDERED_MESSAGES' }); adapter.cleanup();
  });
  it('returns no count claim when processing exceeds the bound', () => {
    const { adapter, list } = fixture([]); list.innerHTML = '<article data-test-message></article>'.repeat(2001);
    expect(adapter.getSnapshot()).toMatchObject({ status: 'unsupported-layout', reason: 'SCAN_LIMIT' }); expect(adapter.getSnapshot()).not.toHaveProperty('renderedMessageCount'); adapter.cleanup();
  });
  it('reports unknown timestamps and keeps ephemeral keys local', () => {
    const { adapter } = fixture(['2026-11-04', null]);
    expect(adapter.getSnapshot()).toMatchObject({ renderedMessageCount: 2, datedMessageCount: 1, timestampCoverage: 'partial', datesDetected: 1 });
    const serialized = JSON.stringify(adapter.getSnapshot()); expect(serialized).not.toMatch(/SYNTHETIC|opaque|local-|element|PRIVATE/); adapter.cleanup();
  });
  it('does not count a list selected as if it were a message', () => {
    const { list, config } = fixture(); config.messageSelector = ':scope';
    expect(detectMessages(list, config, () => 'local')).toMatchObject({ messages: [], limited: false });
  });
});
