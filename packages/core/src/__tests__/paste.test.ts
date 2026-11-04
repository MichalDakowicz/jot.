import { describe, expect, it } from 'vitest';

import type { Block } from '../doc';
import { mdOf, runsOf, splitRuns } from '../field';
import { pasteInto } from '../paste';
import { editOf } from '../typing';

const NO_MENTIONS: string[] = [];

/** A note as blocks, the way the editor holds one open. */
function doc(...blocks: Block[]): Block[] {
  return blocks;
}

/** Each block as "kind:text", which is what these cases are about. */
function shape(blocks: Block[]): string[] {
  return blocks.map((b) => b.kind + ':' + b.text);
}

describe('pasteInto', () => {
  it('turns pasted lines into blocks of their own', () => {
    const put = pasteInto(doc({ kind: 'p', text: '' }), 0, '', 'one\ntwo\nthree', '', NO_MENTIONS);

    expect(put.blocks.map((b) => b.text)).toEqual(['one', 'two', 'three']);
    expect(put.at).toBe(2);
    expect(put.caret).toBe(5);
  });

  it('leaves no empty block between the lines it made', () => {
    const put = pasteInto(
      doc({ kind: 'p', text: '' }),
      0,
      '',
      'one\n\ntwo\n\n\nthree\n',
      '',
      NO_MENTIONS,
    );

    expect(shape(put.blocks)).toEqual(['p:one', 'p:two', 'p:three']);
    expect(put.at).toBe(2);
  });

  it('carries on the line the caret was on, and keeps the rest after', () => {
    const put = pasteInto(doc({ kind: 'p', text: 'ab' }), 0, 'a', 'one\ntwo', 'b', NO_MENTIONS);

    expect(put.blocks.map((b) => b.text)).toEqual(['aone', 'twob']);
    expect(put.at).toBe(1);
    // Between what was pasted and what was after the caret.
    expect(put.caret).toBe(3);
  });

  it('leaves the blocks around it alone', () => {
    const put = pasteInto(
      doc({ kind: 'h1', text: 'Title' }, { kind: 'p', text: '' }, { kind: 'p', text: 'last' }),
      1,
      '',
      'one\ntwo',
      '',
      NO_MENTIONS,
    );

    expect(shape(put.blocks)).toEqual(['h1:Title', 'p:one', 'p:two', 'p:last']);
  });

  it('reads pasted markdown as the shapes it describes', () => {
    const put = pasteInto(
      doc({ kind: 'p', text: '' }),
      0,
      '',
      '# Why\n- one\n- two\n\n> a note',
      '',
      NO_MENTIONS,
    );

    expect(put.blocks.map((b) => b.kind)).toEqual(['h1', 'bullet', 'bullet', 'quote']);
    expect(put.blocks[0].text).toBe('Why');
  });

  it('gives plain lines the shape of the list they land in', () => {
    const put = pasteInto(
      doc({ kind: 'bullet', text: '', depth: 1 }),
      0,
      '',
      'one\ntwo\nthree',
      '',
      NO_MENTIONS,
    );

    expect(put.blocks.map((b) => b.kind)).toEqual(['bullet', 'bullet', 'bullet']);
    expect(put.blocks.map((b) => b.depth)).toEqual([1, 1, 1]);
  });

  it('makes no empty list items out of the blank lines between items', () => {
    const put = pasteInto(
      doc({ kind: 'todo', text: '', done: false }),
      0,
      '',
      'one\n\ntwo',
      '',
      NO_MENTIONS,
    );

    expect(shape(put.blocks)).toEqual(['todo:one', 'todo:two']);
    expect(put.blocks[1].done).toBe(false);
  });

  it('keeps a line that brings its own shape out of the line it landed on', () => {
    const put = pasteInto(
      doc({ kind: 'p', text: 'ab' }),
      0,
      'a',
      '## Why\nbecause',
      'b',
      NO_MENTIONS,
    );

    expect(shape(put.blocks)).toEqual(['p:a', 'h2:Why', 'p:becauseb']);
    expect(put.at).toBe(2);
    expect(put.caret).toBe(7);
  });

  it('gives a block that holds no text of its own a paragraph to land in', () => {
    const put = pasteInto(
      doc({ kind: 'p', text: 'x' }),
      0,
      '',
      'lead\n\n| a | b |\n| --- | --- |\n| 1 | 2 |',
      'x',
      NO_MENTIONS,
    );

    const last = put.blocks[put.blocks.length - 1];
    expect(put.blocks.map((b) => b.kind)).toEqual(['p', 'table', 'p']);
    expect(last.text).toBe('x');
    expect(put.at).toBe(put.blocks.length - 1);
    expect(put.caret).toBe(0);
  });

  it('reads back a span copied out of a note', () => {
    const put = pasteInto(
      doc({ kind: 'p', text: '' }),
      0,
      '',
      '## Why\n\n1. one\n2. two\n\n```js\nconst a = 1;\n```',
      '',
      NO_MENTIONS,
    );

    // The fence holds no plain text, so the caret gets a paragraph under it.
    expect(put.blocks.map((b) => b.kind)).toEqual(['h2', 'number', 'number', 'fence', 'p']);
    expect(put.blocks[3].lang).toBe('js');
    expect(put.blocks[3].text).toBe('const a = 1;');
    expect(put.at).toBe(4);
  });

  it('takes windows line endings', () => {
    const put = pasteInto(doc({ kind: 'p', text: '' }), 0, '', 'one\r\ntwo', '', NO_MENTIONS);

    expect(put.blocks.map((b) => b.text)).toEqual(['one', 'two']);
  });
});

describe('a paste over held blocks', () => {
  it('takes their place, the way the editor clears them first', () => {
    const blocks = doc(
      { kind: 'p', text: 'a' },
      { kind: 'p', text: 'b' },
      { kind: 'p', text: 'c' },
      { kind: 'p', text: 'd' },
    );
    // Blocks 1 and 2 are held: the editor puts one empty block where they were.
    const cleared = [...blocks];
    cleared.splice(1, 2, { kind: 'p', text: '' });
    const put = pasteInto(cleared, 1, '', 'one\ntwo', '', NO_MENTIONS);

    expect(shape(put.blocks)).toEqual(['p:a', 'p:one', 'p:two', 'p:d']);
    expect(put.at).toBe(2);
  });
});

describe('a paste landing in a block', () => {
  it('goes where the selection was, with the annotations either side kept', () => {
    const runs = runsOf('**bold** and *em*', NO_MENTIONS);
    // " and " is selected: the paste lands in its place.
    const split = splitRuns(runs, 4, 9);
    const put = pasteInto(
      doc({ kind: 'p', text: mdOf(runs) }),
      0,
      split.head,
      'one\ntwo',
      split.tail,
      NO_MENTIONS,
    );

    expect(put.blocks.map((b) => b.text)).toEqual(['**bold**one', 'two*em*']);
    expect(put.at).toBe(1);
    // The caret counts plain text, so the delimiters do not move it.
    expect(put.caret).toBe(3);
  });
});

describe('editOf', () => {
  it('reads a pasted run of lines off the two strings', () => {
    expect(editOf('ab', 'aone\ntwob')).toEqual({ start: 1, end: 1, put: 'one\ntwo' });
  });

  it('tells a plain Return from a paste', () => {
    expect(editOf('ab', 'a\nb').put).toBe('\n');
  });

  it('reads a paste that replaced a selection', () => {
    expect(editOf('abcd', 'aX\nYd')).toEqual({ start: 1, end: 3, put: 'X\nY' });
  });

  it('holds still when nothing changed', () => {
    expect(editOf('abc', 'abc')).toEqual({ start: 3, end: 3, put: '' });
  });
});
