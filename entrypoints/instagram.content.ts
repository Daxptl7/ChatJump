import { defineContentScript } from 'wxt/utils/define-content-script';
import { registerConnectionListener } from '../src/messaging/contentListener';

export default defineContentScript({
  matches: ['https://www.instagram.com/*'],
  runAt: 'document_idle',
  main(ctx) {
    const dispose = registerConnectionListener(chrome.runtime, () => location.href);
    ctx.onInvalidated(dispose);
  },
});
