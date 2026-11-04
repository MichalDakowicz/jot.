import { describe, expect, it } from 'vitest';

import { demoteH1, splitTitled, titledDoc } from '../titled';

describe('titled documents', () => {
  it('round-trips title and body', () => {
    const doc = titledDoc('Cells', 'line one\n## Part');
    expect(doc).toBe('# Cells\nline one\n## Part');
    expect(splitTitled(doc)).toEqual({ title: 'Cells', body: 'line one\n## Part' });
  });

  it('keeps an empty title and an empty body', () => {
    expect(titledDoc('', '')).toBe('# \n');
    expect(splitTitled('# \n')).toEqual({ title: '', body: '' });
    expect(splitTitled('# Only a title')).toEqual({ title: 'Only a title', body: '' });
  });

  it('keeps the title exactly as typed, so a round trip is the identity', () => {
    for (const doc of ['# Test \nbody', '#  two spaces\n', '# \n\n# x']) {
      const { title, body } = splitTitled(doc);
      expect(titledDoc(title, body)).toBe(doc);
    }
  });

  it('reads a first line whose mark was lost', () => {
    expect(splitTitled('Cells\nbody')).toEqual({ title: 'Cells', body: 'body' });
  });

  it('keeps a title on one line', () => {
    expect(titledDoc('a\nb', 'x')).toBe('# a b\nx');
  });

  it('demotes a second h1 only', () => {
    expect(demoteH1('# Part two')).toBe('## Part two');
    expect(demoteH1('## Part two')).toBeNull();
    expect(demoteH1('#hashtag')).toBeNull();
  });
});
