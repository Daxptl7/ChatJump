import { afterEach, beforeEach, vi } from 'vitest';

beforeEach(() => {
  history.replaceState({}, '', '/direct/t/synthetic-thread/');
  document.body.replaceChildren();
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, writable: true, value: vi.fn(function (this: HTMLElement, options: ScrollToOptions) { this.scrollTop = options.top ?? this.scrollTop; }) });
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, writable: true, value: vi.fn() });
});

afterEach(() => { vi.useRealTimers(); document.body.replaceChildren(); });
