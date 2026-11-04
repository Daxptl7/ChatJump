import { describe, expect, it } from 'vitest';
import { detectPlatform } from '../src/services/platformDetection';
describe('platform URL detection', () => {
  it('recognizes the supported origin without claiming a conversation', () => expect(detectPlatform('https://www.instagram.com/')).toEqual({ platform: 'instagram', isSupported: true, isConversationRoute: false }));
  it('identifies a candidate DM route separately from DOM detection', () => expect(detectPlatform('https://www.instagram.com/direct/t/synthetic/')).toMatchObject({ isSupported: true, isConversationRoute: true }));
  it.each(['/direct/inbox/', '/direct/t/', '/direct/t/one/details/'])('does not classify %s as an open conversation route', (path) => expect(detectPlatform(`https://www.instagram.com${path}`).isConversationRoute).toBe(false));
  it.each([undefined, '', 'not a URL', 'https://example.com/', 'http://www.instagram.com/', 'https://www.instagram.com.evil.test/', 'https://evilinstagram.com/', 'https://www.instagram.com:8443/', 'https://instagram.com/', 'https://user:secret@www.instagram.com/', 'chrome://extensions/'])('rejects unsupported or inaccessible URL %s', (url) => expect(detectPlatform(url).isSupported).toBe(false));
  it('recognizes WhatsApp without enabling integration', () => expect(detectPlatform('https://web.whatsapp.com/')).toEqual({ platform: 'whatsapp', isSupported: false, isConversationRoute: false }));
});
