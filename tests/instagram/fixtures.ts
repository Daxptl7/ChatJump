import type { VerifiedSelectorProfile } from '../../src/adapters/instagram/selectors';
import { InstagramAdapter } from '../../src/adapters/instagram/InstagramAdapter';

/** All selectors and values in this fixture are synthetic, never Instagram findings. */
export function profile(): VerifiedSelectorProfile {
  return {
    verification: 'manual', conversationSelectors: ['[data-test-conversation]'], conversationKeyAttribute: 'data-test-key',
    messageListSelector: '[data-test-list]', messageSelector: '[data-test-message]',
    timestampRules: [{ selector: 'time[datetime]', read: 'datetime', source: 'time-element', associationVerified: true }],
    timestamps: { timeZone: 'UTC', displayTimeZoneVerified: true, locale: 'en-US', now: Date.parse('2026-11-04T12:00:00Z') },
    scrollSelector: '[data-test-list]',
  };
}

export function fixture(dates: Array<string | null> = ['2026-11-04']): { adapter: InstagramAdapter; root: HTMLElement; list: HTMLElement; config: VerifiedSelectorProfile; add: (date: string | null) => HTMLElement } {
  history.replaceState({}, '', '/direct/t/synthetic-phase2/');
  document.body.innerHTML = '<nav>Unrelated synthetic UI</nav><main><section data-test-conversation data-test-key="opaque-fixture"><div data-test-list></div></section></main>';
  const root = document.querySelector<HTMLElement>('[data-test-conversation]')!;
  const list = root.querySelector<HTMLElement>('[data-test-list]')!;
  list.style.overflowY = 'auto';
  Object.defineProperties(list, { clientHeight: { configurable: true, value: 200 }, scrollHeight: { configurable: true, get: () => 900 } });
  list.getBoundingClientRect = () => ({ top: 0, bottom: 200, left: 0, right: 300, height: 200, width: 300 } as DOMRect);
  const add = (date: string | null): HTMLElement => {
    const element = document.createElement('article'); element.setAttribute('data-test-message', '');
    const body = document.createElement('p'); body.textContent = 'SYNTHETIC PRIVATE BODY'; element.append(body);
    if (date !== null) { const time = document.createElement('time'); time.dateTime = date; element.append(time); }
    element.getBoundingClientRect = () => ({ top: 20, bottom: 40, left: 0, right: 200, height: 20, width: 200 } as DOMRect);
    list.append(element); return element;
  };
  dates.forEach(add);
  const config = profile();
  return { adapter: new InstagramAdapter(document, config), root, list, config, add };
}
