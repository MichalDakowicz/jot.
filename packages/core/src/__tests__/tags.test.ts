import { describe, expect, it } from 'vitest';

import { cleanTag, tagsOf, withoutTag, withTag } from '../tags';

describe('cleanTag', () => {
  it('files a tag the one way, however it was typed', () => {
    expect(cleanTag('#Exam')).toBe('exam');
    expect(cleanTag('  lab work ')).toBe('lab-work');
    expect(cleanTag('##proofs!')).toBe('proofs');
  });

  it('keeps Polish letters', () => {
    expect(cleanTag('Język polski')).toBe('język-polski');
  });

  it('is nothing when nothing is left', () => {
    expect(cleanTag(' # ')).toBe('');
    expect(cleanTag('?!')).toBe('');
  });
});

describe('withTag and withoutTag', () => {
  it('adds at the end, once', () => {
    expect(withTag(['exam'], 'Lab')).toEqual(['exam', 'lab']);
    expect(withTag(['exam'], '#exam')).toEqual(['exam']);
    expect(withTag(['exam'], '  ')).toEqual(['exam']);
  });

  it('drops one', () => {
    expect(withoutTag(['exam', 'lab'], 'exam')).toEqual(['lab']);
  });
});

describe('tagsOf', () => {
  it('reads a row from before the column as no tags', () => {
    expect(tagsOf({})).toEqual([]);
    expect(tagsOf({ tags: null })).toEqual([]);
    expect(tagsOf({ tags: ['exam'] })).toEqual(['exam']);
  });
});
