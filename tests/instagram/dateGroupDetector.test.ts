import { describe, expect, it } from 'vitest';
import { fixture } from './fixtures';
import type { DateGroupStrategy } from '../../src/adapters/instagram/selectors';

const contained: DateGroupStrategy = { kind: 'contained', groupSelector: '[data-test-group]', separatorSelector: '[data-test-separator]', dateRule: { selector: ':scope', read: 'leaf-text', source: 'date-separator', associationVerified: true }, associationVerified: true };
const message = '<article data-test-message></article>';
const separator = (date: string): string => `<div data-test-separator>${date}</div>`;

describe('verified date-group relationships', () => {
  it('assigns a date to multiple contained messages without inventing their clock time', () => {
    const { adapter, list, config } = fixture([]); config.dateGroups = contained;
    list.innerHTML = `<section data-test-group>${separator('2026-11-04')}${message}${message}</section>`;
    const messages = adapter.getRenderedMessages(); expect(messages).toHaveLength(2);
    expect(messages).toMatchObject([{ dateISO: '2026-11-04', source: 'date-group' }, { dateISO: '2026-11-04', source: 'date-group' }]);
    expect(messages[0]).not.toHaveProperty('timestampMs'); adapter.cleanup();
  });
  it('handles multiple independent groups and reversed message order', () => {
    const { adapter, list, config } = fixture([]); config.dateGroups = contained;
    list.style.flexDirection = 'column-reverse';
    list.innerHTML = `<section data-test-group>${message}${separator('2026-11-04')}</section><section data-test-group>${separator('2026-10-15')}${message}</section>`;
    expect(adapter.getSnapshot()).toMatchObject({ earliestRenderedDate: '2026-10-15', latestRenderedDate: '2026-11-04', datesDetected: 2 }); adapter.cleanup();
  });
  it('keeps missing, ambiguous, or virtualized separator dates unknown', () => {
    const { adapter, list, config } = fixture([]); config.dateGroups = contained;
    list.innerHTML = `<section data-test-group>${message}</section><section data-test-group>${separator('2026-11-04')}${separator('2026-11-03')}${message}</section>`;
    expect(adapter.getSnapshot()).toMatchObject({ renderedMessageCount: 2, datedMessageCount: 0, timestampCoverage: 'unknown' });
    list.innerHTML = `<section data-test-group>${separator('2026-11-04')}${message}</section>`;
    expect(adapter.getSnapshot().datedMessageCount).toBe(1); list.querySelector('[data-test-separator]')!.remove(); expect(adapter.getSnapshot().datedMessageCount).toBe(0); adapter.cleanup();
  });
  it('supports a partial contained group while refusing an unrelated preceding label', () => {
    const { adapter, list, config } = fixture([]); config.dateGroups = contained;
    list.innerHTML = `${separator('2026-11-03')}${message}<section data-test-group>${separator('2026-11-04')}${message}</section>`;
    expect(adapter.getSnapshot()).toMatchObject({ renderedMessageCount: 2, datedMessageCount: 1, timestampCoverage: 'partial' }); adapter.cleanup();
  });
  it.each(['forward', 'backward'] as const)('uses only a verified %s sibling relationship', (direction) => {
    const { adapter, list, config } = fixture([]);
    config.dateGroups = { kind: 'siblings', direction, separatorSelector: '[data-test-separator]', dateRule: contained.dateRule, associationVerified: true, orderingVerified: true };
    const nodes = [separator('2026-11-03'), message, message, separator('2026-11-04'), message];
    list.innerHTML = (direction === 'forward' ? nodes : nodes.reverse()).join('');
    expect(adapter.getSnapshot()).toMatchObject({ renderedMessageCount: 3, datedMessageCount: 3, datesDetected: 2 }); adapter.cleanup();
  });
  it('never propagates a sibling date across unknown boundaries or before a missing boundary', () => {
    const { adapter, list, config } = fixture([]);
    config.dateGroups = { kind: 'siblings', direction: 'forward', separatorSelector: '[data-test-separator]', dateRule: contained.dateRule, associationVerified: true, orderingVerified: true };
    list.innerHTML = `${message}${separator('2026-11-04')}${message}<aside>Unknown boundary</aside>${message}`;
    expect(adapter.getSnapshot()).toMatchObject({ renderedMessageCount: 3, datedMessageCount: 1 }); adapter.cleanup();
  });
  it('does not override a conflicting directly associated date', () => {
    const { adapter, list, config } = fixture([]); config.dateGroups = contained;
    list.innerHTML = `<section data-test-group>${separator('2026-11-04')}<article data-test-message><time datetime="2026-11-03"></time></article></section>`;
    expect(adapter.getSnapshot()).toMatchObject({ datedMessageCount: 0, reason: 'AMBIGUOUS_TIMESTAMP' }); adapter.cleanup();
  });
});
