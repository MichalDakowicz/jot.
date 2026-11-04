import { describe, expect, it } from 'vitest';

import { INK } from '../theme/ink';
import { paletteFor } from '../theme/scheme';
import { c } from '../theme/tokens';

const luma = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

describe('paletteFor', () => {
  it('fills every role the old palette had', () => {
    for (const scheme of ['dark', 'light'] as const) {
      expect(Object.keys(paletteFor(scheme)).sort()).toEqual(Object.keys(c).sort());
    }
  });

  it('runs each ramp from the page toward the text', () => {
    const dark = paletteFor('dark');
    expect(luma(dark.n100)).toBeLessThan(luma(dark.n900));
    const light = paletteFor('light');
    expect(luma(light.n100)).toBeGreaterThan(luma(light.n900));
  });

  it('keeps page and text from the inks', () => {
    expect(paletteFor('dark').bg).toBe(INK.dark.bg);
    expect(paletteFor('light').text).toBe(INK.light.text);
  });
});
