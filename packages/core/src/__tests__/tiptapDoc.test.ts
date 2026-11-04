import { describe, expect, it } from 'vitest';

import { docToPM, pmToDoc, type PMNode } from '../tiptapDoc';

const roundTrip = (md: string, titles: string[] = []) => pmToDoc(docToPM(md, titles));

describe('markdown through the Tiptap document', () => {
  it('keeps headings, paragraphs and blank lines as they are', () => {
    const md = '# One\n## Two\n### Three\n#### Four\n\nA line of text.\n\nAnother.';
    expect(roundTrip(md)).toBe(md);
  });

  it('keeps inline marks, links and code', () => {
    const md = 'Use **bold**, *em*, ==marked==, ~~gone~~, `code` and [a link](https://jot.dev).';
    expect(roundTrip(md)).toBe(md);
  });

  it('keeps nested marks nested', () => {
    expect(roundTrip('**bold *em* bold**')).toBe('**bold *em* bold**');
  });

  it('keeps an @mention a mention, only when the note exists', () => {
    const doc = docToPM('See @Week 3 notes.', ['Week 3 notes']);
    const para = doc.content?.[0] as PMNode;
    expect(para.content?.some((n) => n.marks?.some((m) => m.type === 'mention'))).toBe(true);
    expect(pmToDoc(doc)).toBe('See @Week 3 notes.');

    const loose = docToPM('See @Nothing here.', []);
    expect(JSON.stringify(loose)).not.toContain('mention');
  });

  it('keeps bullet, numbered, lettered and to-do lists', () => {
    const md = '- a\n- b\n\n1. one\n2. two\n\na. first\nb. second\n\n- [ ] open\n- [x] done';
    expect(roundTrip(md)).toBe(md);
  });

  it('keeps a list that starts part way along', () => {
    expect(roundTrip('3. three\n4. four')).toBe('3. three\n4. four');
    expect(roundTrip('c. third\nd. fourth')).toBe('c. third\nd. fourth');
  });

  it('nests lists by depth, and mixes kinds across levels', () => {
    const md = '- top\n  - inside\n    - deeper\n  - back\n- again\n\n1. step\n  - note\n  - another\n2. next';
    expect(roundTrip(md)).toBe(md);

    const doc = docToPM('- top\n  - inside');
    const list = doc.content?.[0] as PMNode;
    expect(list.type).toBe('bulletList');
    const item = list.content?.[0] as PMNode;
    expect(item.content?.map((n) => n.type)).toEqual(['paragraph', 'bulletList']);
  });

  it('starts a new list when the kind changes at the same level', () => {
    const doc = docToPM('- a\n1. b');
    expect(doc.content?.map((n) => n.type)).toEqual(['bulletList', 'orderedList', 'paragraph']);
  });

  it('keeps quotes, one quote for lines that follow each other', () => {
    const md = '> first\n> second\n\nBetween\n\n> third';
    expect(roundTrip(md)).toBe(md);
    expect(docToPM('> a\n> b').content?.map((n) => n.type)).toEqual(['blockquote', 'paragraph']);
  });

  it('keeps rules and fenced code, language and all', () => {
    const md = 'Before\n---\n```python\nprint("hi")\n\nx = 1\n```\n```\n\n```';
    expect(roundTrip(md)).toBe(md);
  });

  it('keeps a table with marks in its cells', () => {
    const md = '| Term | Meaning |\n| --- | --- |\n| **a** | b |\n| c | `d` |';
    expect(roundTrip(md)).toBe(md);
  });

  it('leaves a paragraph to type into after a last block, without writing it down', () => {
    const endings = ['| a | b |\n| --- | --- |\n| c | d |', '```\ncode\n```', '- item', '---'];
    for (const md of endings) {
      const doc = docToPM(md);
      expect(doc.content?.[doc.content.length - 1]).toEqual({ type: 'paragraph' });
      expect(pmToDoc(doc)).toBe(md);
    }
    // A paragraph the writer did leave is kept.
    expect(roundTrip('one\n\ntwo')).toBe('one\n\ntwo');
  });

  it('writes the space outside a mark, so it opens marked', () => {
    const doc: PMNode = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'text ', marks: [{ type: 'bold' }] },
            { type: 'text', text: 'after' },
          ],
        },
      ],
    };
    const md = pmToDoc(doc);
    expect(md).toBe('**text** after');
    expect(roundTrip(md)).toBe(md);
  });

  it('opens an empty note as one empty paragraph', () => {
    expect(docToPM('').content).toEqual([{ type: 'paragraph' }]);
    expect(roundTrip('')).toBe('');
  });

  it('writes a hard break as a space rather than a second line', () => {
    const doc: PMNode = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'a' }, { type: 'hardBreak' }, { type: 'text', text: 'b' }],
        },
      ],
    };
    expect(pmToDoc(doc)).toBe('a b');
  });
});
