import { describe, expect, it } from 'vitest';

import { convertMarker } from '../doc';
import { dropMarker } from '../field';

const NO_MENTIONS: string[] = [];

/** What the editor does with a block once its field reports `plain`. */
function shapeOf(md: string, plain: string) {
  const converted = convertMarker(plain);
  if (!converted) return null;
  const cut = plain.length - converted.text.length;
  return { kind: converted.kind, text: dropMarker(md, cut, NO_MENTIONS) };
}

describe('a marker typed in front of text already there', () => {
  it('keeps the first letter of a bullet', () => {
    expect(shapeOf('- Hello', '- Hello')).toEqual({ kind: 'bullet', text: 'Hello' });
  });

  it('keeps the first letter of a numbered and a lettered item', () => {
    expect(shapeOf('1. Hello', '1. Hello')).toEqual({ kind: 'number', text: 'Hello' });
    expect(shapeOf('a. Hello', 'a. Hello')).toEqual({ kind: 'alpha', text: 'Hello' });
  });

  it('keeps the first letter of a heading and a checkbox', () => {
    expect(shapeOf('## Hello', '## Hello')).toEqual({ kind: 'h2', text: 'Hello' });
    expect(shapeOf('[] Hello', '[] Hello')).toEqual({ kind: 'todo', text: 'Hello' });
  });

  it('keeps what the rest of the line is marked up with', () => {
    expect(shapeOf('- **Hello** there', '- Hello there')).toEqual({
      kind: 'bullet',
      text: '**Hello** there',
    });
  });

  it('leaves an empty item empty', () => {
    expect(shapeOf('- ', '- ')).toEqual({ kind: 'bullet', text: '' });
  });
});
