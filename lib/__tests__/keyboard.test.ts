import { describe, expect, it } from 'vitest';

import { keyboardHeight } from '../keyboard';

describe('keyboardHeight', () => {
  it('is the height of the frame the keyboard reports', () => {
    expect(keyboardHeight({ height: 312 })).toBe(312);
  });

  it('is 0 when there is no frame, or an empty or negative one', () => {
    expect(keyboardHeight(undefined)).toBe(0);
    expect(keyboardHeight({ height: 0 })).toBe(0);
    expect(keyboardHeight({ height: -20 })).toBe(0);
  });
});
