import { describe, expect, it } from 'vitest';

import { countOf, plural } from '../count';

describe('countOf', () => {
  it('counts words and characters', () => {
    expect(countOf('Hello brave new world')).toEqual({ words: 4, chars: 21 });
  });

  it('counts nothing for nothing', () => {
    expect(countOf('')).toEqual({ words: 0, chars: 0 });
    expect(countOf('  \n  ')).toEqual({ words: 0, chars: 4 });
  });

  it('lets a block break split words without counting as a character', () => {
    expect(countOf('one\ntwo')).toEqual({ words: 2, chars: 6 });
  });

  it('counts Polish letters and emoji as one character each', () => {
    expect(countOf('Żółć 😀')).toEqual({ words: 2, chars: 6 });
  });

  it('counts a tab or run of spaces as one gap between words', () => {
    expect(countOf('a\t\tb   c')).toEqual({ words: 3, chars: 8 });
  });
});

describe('plural', () => {
  it('picks the noun and groups thousands', () => {
    expect(plural(1, 'word')).toBe('1 word');
    expect(plural(0, 'word')).toBe('0 words');
    expect(plural(1234, 'character')).toBe('1,234 characters');
  });
});
