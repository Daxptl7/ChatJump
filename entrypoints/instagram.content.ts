import { defineContentScript } from 'wxt/utils/define-content-script';
import { initializeInstagramRuntime } from '../src/adapters/instagram/runtime';

export default defineContentScript({
  matches: ['https://www.instagram.com/*'],
  runAt: 'document_idle',
  main(ctx) {
    const dispose = initializeInstagramRuntime(chrome.runtime, document);
    ctx.onInvalidated(dispose);
  },
});
