import { describe, expect, it } from 'vitest';

import { headingLines, notebookDocOf, sectionsOf } from '../notebookDoc';

describe('notebook documents', () => {
  it('splits on h1 lines into notes', () => {
    const { lead, sections } = sectionsOf('# Cells\nmembrane\n## Parts\n# Mitosis\nphases');
    expect(lead).toBe('');
    expect(sections).toEqual([
      { title: 'Cells', body: 'membrane\n## Parts', line: 0 },
      { title: 'Mitosis', body: 'phases', line: 3 },
    ]);
  });

  it('joins notes back into the same document', () => {
    const notes = [
      { title: 'A', body: 'Lecture 1\n\n' },
      { title: 'B', body: '' },
      { title: 'C', body: 'x\n## sub' },
    ];
    const doc = notebookDocOf(notes);
    expect(doc).toBe('# A\nLecture 1\n\n\n# B\n# C\nx\n## sub');
    expect(sectionsOf(doc).sections.map(({ title, body }) => ({ title, body }))).toEqual(notes);
  });

  it('leaves a "# " inside a code fence alone', () => {
    expect(headingLines(['# A', '```', '# not a note', '```', '# B'])).toEqual([0, 4]);
  });

  it('keeps text above the first heading apart', () => {
    expect(sectionsOf('stray\n# A').lead).toBe('stray');
    expect(sectionsOf('').sections).toEqual([]);
  });

  it('keeps titles on one line', () => {
    expect(notebookDocOf([{ title: 'a\nb', body: '' }])).toBe('# a b');
  });
});
