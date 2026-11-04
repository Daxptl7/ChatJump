import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? sources(join(directory, entry.name)) : /\.(css|tsx|svg)$/.test(entry.name) ? [readFileSync(join(directory, entry.name), 'utf8')] : []);
}
describe('design contract', () => {
  const css = readFileSync('src/styles/theme.css', 'utf8');
  it('contains no gradients or rounded utility classes in shipped UI source', () => {
    const all = [...sources('src'), ...sources('entrypoints'), ...sources('public')].join('\n');
    expect(all).not.toMatch(/(?:linear|radial|conic)-gradient\s*\(|<(?:linear|radial)Gradient|\brounded-(?:full|sm|md|lg|xl|2xl)\b|\bbg-(?:gradient|linear)-/i);
  });
  it('enforces square controls with visible focus and readable disabled states', () => {
    expect(css).toMatch(/button, \[role="button"\].*border-radius: 0 !important/);
    expect(css).toContain(':focus-visible'); expect(css).toContain('button:disabled'); expect(css).not.toMatch(/opacity:\s*0\./);
  });
  it('bounds the popup width and lets content wrap', () => { expect(css).toContain('width: 360px;'); expect(css).toContain('max-width: 360px'); expect(css).toContain('(max-width: 359px)'); expect(css).toContain('overflow-wrap: anywhere'); });
  it('maintains at least 4.5:1 contrast for the actual text/background tokens', () => {
    const token = (name: string): string => css.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`))![1]!;
    const luminance = (hex: string): number => {
      const values = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
      return values[0]! * 0.2126 + values[1]! * 0.7152 + values[2]! * 0.0722;
    };
    for (const [foreground, background] of [['text-primary', 'background'], ['text-secondary', 'background'], ['text-secondary', 'surface'], ['success', 'background'], ['error', 'background'], ['button-text', 'button-primary']]) {
      const a = luminance(token(foreground!)), b = luminance(token(background!));
      expect((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
