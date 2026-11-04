import { describe, expect, it } from 'vitest';

import { INK } from '../theme/ink';
import { LOGO_COLORS } from '../theme/logo';

describe('logo colours', () => {
  it('are the dark inks, so the mark and the dark page are one slate', () => {
    expect(LOGO_COLORS).toEqual({ tile: INK.dark.bg, letter: INK.dark.text, caret: INK.dark.accent });
  });
});
