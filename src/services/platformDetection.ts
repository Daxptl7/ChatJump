import type { PlatformDetectionResult } from '../types/platform';

export function detectPlatform(value?: string): PlatformDetectionResult {
  const unsupported: PlatformDetectionResult = { platform: 'unsupported', isSupported: false, isConversationRoute: false };
  if (!value) return unsupported;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.port || url.username || url.password) return unsupported;
    // Matches the declarative content-script scope; the bare host is intentionally unsupported.
    if (url.hostname === 'www.instagram.com') {
      return { platform: 'instagram', isSupported: true, isConversationRoute: /^\/direct\/t\/[^/]+\/?$/.test(url.pathname) };
    }
    if (url.hostname === 'web.whatsapp.com') return { platform: 'whatsapp', isSupported: false, isConversationRoute: false };
  } catch { /* No raw input or URL is retained in results. */ }
  return unsupported;
}
