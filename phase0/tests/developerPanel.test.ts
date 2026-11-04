import { describe, expect, it, vi } from 'vitest';
import { mountDeveloperPanel } from '../src/developerPanel';
import { fixture, scrollOptions } from './fixtures';

const settle = async (): Promise<void> => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

describe('minimal developer panel', () => {
  it('uses solid palette colors, square buttons, labels, live status, and focus styles', () => {
    const { adapter } = fixture(); const panel = mountDeveloperPanel({ adapter, timeZone: 'UTC' }); const shadow = panel.element.shadowRoot!;
    const css = shadow.querySelector('style')!.textContent;
    expect(css).not.toMatch(/(?:linear|radial|conic)-gradient\s*\(/i);
    expect(css).toContain('border-radius: 0 !important'); expect(css).toContain(':focus-visible');
    expect(shadow.querySelector('label')?.htmlFor).toBe('target'); expect(shadow.querySelector('[role="status"]')).not.toBeNull();
    expect(shadow.querySelectorAll('button')).toHaveLength(4); panel.remove();
  });
  it('runs a search and renders structured results', async () => {
    const { adapter } = fixture(); const done = vi.fn(); const panel = mountDeveloperPanel({ adapter, timeZone: 'UTC' }, done); const shadow = panel.element.shadowRoot!;
    (shadow.getElementById('target') as HTMLInputElement).value = '2026-11-04'; shadow.getElementById('start')!.click(); await settle();
    expect(shadow.getElementById('status')!.textContent).toBe('Status: found'); expect(done).toHaveBeenCalledTimes(1); panel.remove();
  });
  it('cancels and disconnects observers when removed during a search', async () => {
    vi.useFakeTimers(); const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect'); const { adapter } = fixture(); const done = vi.fn();
    const panel = mountDeveloperPanel({ adapter, timeZone: 'UTC', scroll: scrollOptions }, done); const shadow = panel.element.shadowRoot!;
    (shadow.getElementById('target') as HTMLInputElement).value = '2026-10-04'; shadow.getElementById('start')!.click(); panel.remove(); await settle();
    expect(panel.element.isConnected).toBe(false); expect(disconnect).toHaveBeenCalled(); expect(done).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
    shadow.getElementById('start')!.click(); await settle(); expect(vi.getTimerCount()).toBe(0);
  });
  it('replaces an existing panel and can move away from host controls', () => {
    const { adapter } = fixture(); const first = mountDeveloperPanel({ adapter, timeZone: 'UTC' }); const second = mountDeveloperPanel({ adapter, timeZone: 'UTC' });
    expect(first.element.isConnected).toBe(false); second.element.shadowRoot!.getElementById('move')!.click(); expect(second.element.style.left).toBe('8px');
    second.element.shadowRoot!.getElementById('close')!.click(); expect(second.element.isConnected).toBe(false);
  });
});
