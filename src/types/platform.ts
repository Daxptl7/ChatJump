export type Platform = 'instagram' | 'whatsapp' | 'unsupported';

export interface PlatformDetectionResult {
  platform: Platform;
  isSupported: boolean;
  /** URL candidate only, never evidence of a rendered conversation. */
  isConversationRoute: boolean;
}
