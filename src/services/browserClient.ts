import type { BrowserClient } from '../types/extension';

export function createBrowserClient(): BrowserClient | undefined {
  if (typeof chrome === 'undefined' || !chrome.tabs?.query || !chrome.tabs.sendMessage) return undefined;
  return {
    queryActiveTab: async () => (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0],
    sendMessage: (tabId, message) => chrome.tabs.sendMessage(tabId, message, { frameId: 0 }),
    subscribe: (onChange) => {
      const onActivated = (): void => onChange();
      const onUpdated = (_id: number, info: chrome.tabs.OnUpdatedInfo, tab: chrome.tabs.Tab): void => {
        if (tab.active && (info.status !== undefined || info.url !== undefined)) onChange();
      };
      const onRemoved = (): void => onChange();
      chrome.tabs.onActivated.addListener(onActivated);
      chrome.tabs.onUpdated.addListener(onUpdated);
      chrome.tabs.onRemoved.addListener(onRemoved);
      return () => {
        chrome.tabs.onActivated.removeListener(onActivated);
        chrome.tabs.onUpdated.removeListener(onUpdated);
        chrome.tabs.onRemoved.removeListener(onRemoved);
      };
    },
  };
}
