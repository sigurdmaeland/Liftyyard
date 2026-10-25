import { describe, expect, it } from '@jest/globals';

import { Colors } from '@/theme';

/** WCAG 2.1: relativ luminans og kontrastforhold mellom to farger (#RRGGBB). */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe.each(['light', 'dark'] as const)('kontrast i %s modus (WCAG AA)', (mode) => {
  const c = Colors[mode];

  it.each([
    ['text', 'background'],
    ['text', 'backgroundElement'],
    ['text', 'card'],
    ['textSecondary', 'background'],
    ['textSecondary', 'backgroundElement'],
    ['textSecondary', 'card'],
    ['accent', 'background'],
    ['accent', 'card'],
    ['accent', 'backgroundElement'],
    ['danger', 'background'],
  ] as const)('%s på %s er minst 4,5:1', (fg, bg) => {
    expect(contrast(c[fg], c[bg])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(['accentFill', 'dangerFill'] as const)('hvit tekst på %s er minst 4,5:1', (bg) => {
    expect(contrast('#FFFFFF', c[bg])).toBeGreaterThanOrEqual(4.5);
  });

  it('hvitt hake-symbol på successFill er minst 3:1 (grafikk)', () => {
    expect(contrast('#FFFFFF', c.successFill)).toBeGreaterThanOrEqual(3);
  });
});
