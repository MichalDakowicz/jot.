import { describe, expect, it } from 'vitest';

import { barRange, pasteRuns, toggleRuns, typeInto } from '../field';
import { parseRuns, serializeRuns, type Pending, type Run } from '../rich';

const NO_MENTIONS: string[] = [];

/** Each run as "text{marks}", which is what these cases are about. */
function shape(runs: Run[]): string[] {
  return runs.map((r) => r.text + '{' + Object.keys(r.marks).sort().join(',') + '}');
}

describe('parseRuns', () => {
  it('annotates a pair nested inside another', () => {
    expect(shape(parseRuns('**bold *italic* bold**'))).toEqual([
      'bold {bold}',
      'italic{bold,em}',
      ' bold{bold}',
    ]);
  });

  // The closing run is three stars: one closes the em, two close the bold.
  it('shares out a closing run of stars between the pairs it ends', () => {
    expect(shape(parseRuns('**bold *italic***'))).toEqual(['bold {bold}', 'italic{bold,em}']);
    expect(shape(parseRuns('***italic* bold**'))).toEqual(['italic{bold,em}', ' bold{bold}']);
  });

  it('reads bold nested inside italic', () => {
    expect(shape(parseRuns('*em **strong** em*'))).toEqual([
      'em {em}',
      'strong{bold,em}',
      ' em{em}',
    ]);
  });

  it('takes "***x***" as both at once', () => {
    expect(shape(parseRuns('***both***'))).toEqual(['both{bold,em}']);
  });

  it('keeps a star that closes nothing', () => {
    expect(shape(parseRuns('**a***'))).toEqual(['a{bold}', '*{}']);
  });

  it('leaves arithmetic alone', () => {
    expect(shape(parseRuns('2 * 3 * 4'))).toEqual(['2 * 3 * 4{}']);
  });

  it('keeps code literal inside a pair around it', () => {
    expect(shape(parseRuns('**bold `code` bold**'))).toEqual([
      'bold {bold}',
      'code{bold,code}',
      ' bold{bold}',
    ]);
  });
});

describe('serializeRuns', () => {
  // Wrapped run by run, the bold closed and reopened around the italic, and
  // "**bold *****italic***** bold**" reads back as literal stars.
  it('writes a shared mark once around the whole stretch', () => {
    expect(serializeRuns(parseRuns('**bold *italic* bold**'))).toBe('**bold *italic* bold**');
    expect(serializeRuns(parseRuns('==mark *em* mark=='))).toBe('==mark *em* mark==');
  });

  it('round-trips every nest the parser reads', () => {
    [
      '**bold *italic* bold**',
      '**bold *italic***',
      '***both***',
      '*em **strong** em*',
      '**a** and *b*',
      '**bold `code` bold**',
      '~~gone *and* gone~~',
      '[**label**](https://x.test)',
      '2 * 3 * 4',
    ].forEach((md) => {
      expect(shape(parseRuns(serializeRuns(parseRuns(md))))).toEqual(shape(parseRuns(md)));
    });
  });

  // "**text **" is not a pair: a closing delimiter has to hug its text, so the
  // note reopened with the stars showing and nothing bold.
  describe('whitespace at the edge of a mark', () => {
    const run = (text: string, marks: Run['marks'] = {}): Run => ({ text, marks });

    it('writes a trailing space outside the delimiters', () => {
      expect(serializeRuns([run('text ', { bold: true })])).toBe('**text** ');
      expect(serializeRuns([run('text ', { em: true })])).toBe('*text* ');
      expect(serializeRuns([run('text ', { mark: true })])).toBe('==text== ');
      expect(serializeRuns([run('text ', { strike: true })])).toBe('~~text~~ ');
    });

    it('writes a leading space, and both, outside', () => {
      expect(serializeRuns([run(' text', { bold: true })])).toBe(' **text**');
      expect(serializeRuns([run('  text  ', { bold: true })])).toBe('  **text**  ');
      expect(serializeRuns([run('\ttext', { em: true })])).toBe('\t*text*');
    });

    it('moves the space out of a link label too', () => {
      expect(serializeRuns([run('a link ', { link: 'https://x.test' })])).toBe('[a link](https://x.test) ');
    });

    it('leaves a space in the middle of a mark alone', () => {
      expect(serializeRuns([run('two words', { bold: true })])).toBe('**two words**');
    });

    it('does not mark text that is only whitespace', () => {
      expect(serializeRuns([run('a'), run(' ', { bold: true }), run('b')])).toBe('a b');
      expect(serializeRuns([run('   ', { em: true })])).toBe('   ');
    });

    it('moves the space out of every level of a nest', () => {
      const runs = [run('bold ', { bold: true }), run('em ', { bold: true, em: true })];
      const md = serializeRuns(runs);
      expect(md).toBe('**bold *em*** ');
      expect(shape(parseRuns(md))).toEqual(['bold {bold}', 'em{bold,em}', ' {}']);
    });

    it('reads back marked, with the space outside', () => {
      const md = serializeRuns([run('text ', { bold: true }), run('more')]);
      expect(md).toBe('**text** more');
      expect(shape(parseRuns(md))).toEqual(['text{bold}', ' more{}']);
    });

    it('reads back the same on every further save', () => {
      const once = serializeRuns([run('a ', { bold: true }), run(' b', { em: true })]);
      expect(serializeRuns(parseRuns(once))).toBe(once);
    });
  });
});

describe('pasteRuns', () => {
  it('reads a pasted nest all the way down', () => {
    const put = pasteRuns([], 0, 0, '**bold *italic* bold**', NO_MENTIONS);

    expect(shape(put.runs)).toEqual(['bold {bold}', 'italic{bold,em}', ' bold{bold}']);
    expect(put.plain).toBe('bold italic bold');
    expect(put.caret).toBe(16);
  });

  it('lands inside what is already there', () => {
    const runs = parseRuns('ab');
    const put = pasteRuns(runs, 1, 1, '*em*', NO_MENTIONS);

    expect(shape(put.runs)).toEqual(['a{}', 'em{em}', 'b{}']);
    expect(put.caret).toBe(3);
  });

  it('takes the annotation of the selection it replaced', () => {
    const runs = parseRuns('**bold**');
    const put = pasteRuns(runs, 0, 4, 'new *bit*', NO_MENTIONS);

    expect(shape(put.runs)).toEqual(['new {bold}', 'bit{bold,em}']);
  });

  it('keeps a paste inside code as it was written', () => {
    const runs = parseRuns('`code`');
    const put = pasteRuns(runs, 4, 4, '*em*', NO_MENTIONS);

    expect(put.plain).toBe('code*em*');
    expect(shape(put.runs)).toEqual(['code*em*{code}']);
  });
});

describe('typeInto', () => {
  /** Type `text` at `at`, one key at a time, the caret moving on as it goes. */
  function typeAt(runs: Run[], at: number, text: string) {
    let now = { runs, plain: runs.map((r) => r.text).join(''), caret: at, pending: null as Pending };
    for (const ch of text) {
      const next = now.plain.slice(0, now.caret) + ch + now.plain.slice(now.caret);
      now = typeInto(now.runs, next, now.pending, now.caret + 1);
    }
    return now;
  }

  it('keeps the caret behind a letter typed in front of the same letter', () => {
    const typed = typeAt(parseRuns('I like apples'), 7, 'an ');

    expect(typed.plain).toBe('I like an apples');
    expect(typed.caret).toBe(10);
  });

  it('keeps the caret behind a space typed in front of a space', () => {
    const typed = typeAt(parseRuns('one two'), 3, ' and');

    expect(typed.plain).toBe('one and two');
    expect(typed.caret).toBe(7);
  });

  it('gives a letter typed at the head of a run the marks of where it was typed', () => {
    // "a" then a bold "a": typed between them, the new letter is plain.
    const typed = typeInto(parseRuns('a**ab**'), 'aaab', null, 2);

    expect(shape(typed.runs)).toEqual(['aa{}', 'ab{bold}']);
  });

  it('takes out the letter the caret was behind, not its twin', () => {
    // Backspace behind the bold "a" of "**a**a" takes the bold one.
    const typed = typeInto(parseRuns('**a**a'), 'a', null, 0);

    expect(shape(typed.runs)).toEqual(['a{}']);
  });

  it('falls back to reading the change off the text when the caret does not fit it', () => {
    const typed = typeInto(parseRuns('abc'), 'abxc', null, 0);

    expect(typed.plain).toBe('abxc');
    expect(typed.caret).toBe(3);
  });
});

describe('barRange', () => {
  it('takes the whole selection, not the caret at its head', () => {
    const range = barRange({ start: 4, end: 9 }, null, 20);

    expect(range).toEqual({ start: 4, end: 9 });
    expect(shape(toggleRuns(parseRuns('the quick fox'), range.start, range.end, 'bold'))).toEqual([
      'the {}',
      'quick{bold}',
      ' fox{}',
    ]);
  });

  it('falls back to the last selection seen in the block when the press moved it away', () => {
    expect(barRange(null, { start: 2, end: 5 }, 20)).toEqual({ start: 2, end: 5 });
  });

  it('prefers a live selection over the one kept', () => {
    expect(barRange({ start: 6, end: 8 }, { start: 2, end: 5 }, 20)).toEqual({ start: 6, end: 8 });
  });

  it('turns a selection made backwards round and keeps it inside the block', () => {
    expect(barRange({ start: 9, end: 4 }, null, 20)).toEqual({ start: 4, end: 9 });
    expect(barRange({ start: 4, end: 30 }, null, 12)).toEqual({ start: 4, end: 12 });
  });

  it('is the end of the block, a no-op, with nothing selected anywhere', () => {
    expect(barRange(null, null, 7)).toEqual({ start: 7, end: 7 });
  });
});
