import { describe, expect, it } from 'vitest';

import { isTableRow, layoutRow, tableColumns, type RowEdit } from '../tables';

/** The row as it reads with its edits shown over it. */
function shown(line: string, edits: RowEdit[]): string {
  let out = '';
  let at = 0;
  for (const e of edits) {
    out += line.slice(at, e.from) + e.text;
    at = e.to;
  }
  return out + line.slice(at);
}

function laidOut(lines: string[]): string[] | null {
  const columns = tableColumns(lines);
  if (!columns) return null;
  return lines.map((line, k) => shown(line, layoutRow(line, columns.widths, columns.align, k === 1)));
}

describe('table layout', () => {
  it('pads every column to its widest cell, the rule in dashes to match', () => {
    expect(laidOut([
      '| bohater | zawód |',
      '| --- | --- |',
      '| Winston Smith | Ministerstwo Prawdy |',
    ])).toEqual([
      '| bohater       | zawód               |',
      '| ------------- | ------------------- |',
      '| Winston Smith | Ministerstwo Prawdy |',
    ]);
  });

  it('keeps alignment marks and fills short rows', () => {
    expect(laidOut(['|a|b|c|', '|:-|:-:|-:|', '|1|'])).toEqual([
      '| a   |  b  |   c |',
      '| :-- | :-: | --: |',
      '| 1   |     |     |',
    ]);
  });

  it('counts Polish letters as one column each', () => {
    const out = laidOut(['| ż | x |', '|---|---|', '| żółw | y |'])!;
    expect(out[0]).toBe('| ż    | x   |');
    expect(out[2]).toBe('| żółw | y   |');
  });

  it('keeps an escaped pipe inside its cell', () => {
    expect(laidOut(['| a \\| b | c |', '|---|---|'])![0]).toBe('| a \\| b | c   |');
  });

  it('fills in a missing closing pipe, as GitHub tables leave it off', () => {
    expect(laidOut(['| a | b', '| --- | --- ', '| x | yy |  '])).toEqual([
      '| a   | b   |',
      '| --- | --- |',
      '| x   | yy  |',
    ]);
  });

  it('never covers the text of a cell, so it stays editable', () => {
    const line = '| Julia |  Departament |';
    for (const e of layoutRow(line, [8, 14], ['', ''], false)) {
      expect(line.slice(e.from, e.to).trim()).toBe('');
    }
  });

  it('shows an aligned table as it is', () => {
    const once = laidOut(['| a | bb |', '|-|-|', '| ccc | d |'])!;
    const columns = tableColumns(once)!;
    once.forEach((line, k) => expect(layoutRow(line, columns.widths, columns.align, k === 1)).toEqual([]));
  });

  it('leaves alone what is not a table', () => {
    expect(tableColumns(['| a | b |', 'not a rule'])).toBeNull();
    expect(tableColumns(['| a |'])).toBeNull();
    expect(isTableRow('a | b')).toBe(false);
  });
});
