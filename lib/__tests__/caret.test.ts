import { describe, expect, it } from 'vitest';

import { nearestOnLine, type CaretEdge } from '../caret';

/**
 * A block drawn as monospaced lines of 10px characters, 25px apart: each line
 * is the text that sits on it, wrap included.
 */
function drawn(...lines: string[]): CaretEdge[] {
  const edges: CaretEdge[] = [];
  let at = 0;
  lines.forEach((line, row) => {
    const top = row * 25;
    for (let k = 0; k < line.length; k += 1) {
      edges.push({ at: at + k, x: k * 10, top, bottom: top + 20 });
      edges.push({ at: at + k + 1, x: (k + 1) * 10, top, bottom: top + 20 });
    }
    at += line.length;
  });
  return edges;
}

describe('nearestOnLine', () => {
  it('keeps the column going down into a block', () => {
    expect(nearestOnLine(drawn('hello world'), 52, 1)).toBe(5);
  });

  it('keeps the column going up, on the last line of a wrapped block', () => {
    // "first line " wraps; "second" is the last line, offsets 11..17.
    expect(nearestOnLine(drawn('first line ', 'second'), 31, -1)).toBe(14);
  });

  it('stays on the first line going down into a wrapped block', () => {
    expect(nearestOnLine(drawn('first line ', 'second'), 31, 1)).toBe(3);
  });

  it('lands at the end of a line too short to reach the column', () => {
    expect(nearestOnLine(drawn('hi'), 300, 1)).toBe(2);
  });

  it('does not land on the wrap, which a browser draws on the line below', () => {
    // Offset 11 ends the first line and heads the second.
    expect(nearestOnLine(drawn('first line ', 'second'), 300, 1)).toBe(10);
  });

  it('has nothing to say about an empty block', () => {
    expect(nearestOnLine([], 40, 1)).toBeNull();
  });
});
