import { describe, expect, it } from 'vitest';

import { parseInline, type Inline } from '../markdown';

/** The tree as "kind(kids)", which is what these cases are about. */
function shape(kids: Inline[]): string {
  return kids
    .map((k) => {
      if (k.t === 'text') return k.v;
      if (k.t === 'code') return 'code(' + k.v + ')';
      if (k.t === 'mention') return k.t + '(' + k.v + ')';
      return k.t + '(' + shape(k.kids) + ')';
    })
    .join('');
}

describe('parseInline', () => {
  it('leaves a # in the text as text, since tags live under the title', () => {
    expect(shape(parseInline('revise for the #exam'))).toBe('revise for the #exam');
  });

  it('reads a pair nested inside another', () => {
    expect(shape(parseInline('**bold *italic* bold**'))).toBe('bold(bold em(italic) bold)');
  });

  // The closing run is three stars: one closes the em, two close the bold.
  it('shares out a closing run of stars between the pairs it ends', () => {
    expect(shape(parseInline('**bold *italic***'))).toBe('bold(bold em(italic))');
    expect(shape(parseInline('***italic* bold**'))).toBe('bold(em(italic) bold)');
  });

  it('reads bold nested inside italic', () => {
    expect(shape(parseInline('*em **strong** em*'))).toBe('em(em bold(strong) em)');
  });

  it('leaves arithmetic alone', () => {
    expect(shape(parseInline('2 * 3 * 4'))).toBe('2 * 3 * 4');
  });

  it('leaves a pair that never closes as it was written', () => {
    expect(shape(parseInline('**bold'))).toBe('**bold');
  });
});
