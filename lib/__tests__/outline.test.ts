import { describe, expect, it } from 'vitest';
import { outlineOf } from '../outline';

describe('reading outline', () => {
  it('keeps heading hierarchy, readable labels, and separate duplicate targets', () => {
    const outline = outlineOf('# **Start**\n\n## A [link](https://example.com)\n### `Code`\n#### End\n## End');
    expect(outline.map(({ title, level }) => ({ title, level }))).toEqual([
      { title: 'Start', level: 1 }, { title: 'A link', level: 2 },
      { title: 'Code', level: 3 }, { title: 'End', level: 4 }, { title: 'End', level: 2 },
    ]);
    expect(new Set(outline.map((heading) => heading.blockIndex)).size).toBe(5);
  });
  it('excludes code fences and ordinary text containing hashes', () => {
    expect(outlineOf('Text #tag\n```\n# Not a heading\n```\n## Real').map((heading) => heading.title)).toEqual(['Real']);
    expect(outlineOf('No headings')).toEqual([]);
  });
});
