import { describe, expect, it } from 'vitest';
import { detectScrollContainer } from '../../src/adapters/instagram/scrollContainerDetector';
import { fixture } from './fixtures';

describe('read-only scroll geometry', () => {
  it('identifies the list container but keeps unverified chronology unknown', () => {
    const { root, list, config } = fixture(); list.scrollTop = -30; list.style.flexDirection = 'column-reverse';
    expect(detectScrollContainer(root, list, config)).toMatchObject({ element: list, isScrollable: true, olderDirection: 'unknown' }); expect(list.scrollTop).toBe(-30);
  });
  it('uses an explicitly verified direction and reports unscrollable content', () => {
    const { root, list, config } = fixture(); config.olderDirection = 'down'; config.directionVerified = true;
    expect(detectScrollContainer(root, list, config).olderDirection).toBe('down'); Object.defineProperty(list, 'scrollHeight', { value: 100 });
    expect(detectScrollContainer(root, list, config).isScrollable).toBe(false);
  });
  it('rejects unrelated scrolling and ambiguous candidates', () => {
    const { root, list, config } = fixture(); config.scrollSelector = 'body'; expect(detectScrollContainer(root, list, config).element).toBeNull();
    config.scrollSelector = 'article'; expect(detectScrollContainer(root, list, config).element).toBeNull();
  });
  it('can identify a single structural scroll ancestor of an already verified message list', () => {
    const { root, list, config } = fixture(); delete config.scrollSelector;
    expect(detectScrollContainer(root, list, config)).toMatchObject({ element: list, olderDirection: 'unknown', isScrollable: true });
  });
});
