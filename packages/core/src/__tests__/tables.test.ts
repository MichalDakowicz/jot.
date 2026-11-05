import { describe, expect, it } from 'vitest';

import { isTableRow, rowParts, tableTracks } from '../tables';

const kinds = (line: string) => rowParts(line).map((p) => [p.kind, line.slice(p.from, p.to), p.column]);

describe('rowParts', () => {
  it('cuts a row into pipes and cells, end to end', () => {
    expect(kinds('  | a | bb |  ')).toEqual([
      ['pipe', '  |', 1], ['cell', ' a ', 2], ['pipe', '|', 3], ['cell', ' bb ', 4], ['pipe', '|  ', 5],
    ]);
  });

  it('takes a last cell with no closing pipe to the end', () => {
    expect(kinds('| a | b')).toEqual([['pipe', '|', 1], ['cell', ' a ', 2], ['pipe', '|', 3], ['cell', ' b', 4]]);
  });

  it('keeps an escaped pipe inside its cell', () => {
    expect(kinds('| a \\| b |')).toEqual([['pipe', '|', 1], ['cell', ' a \\| b ', 2], ['pipe', '|', 3]]);
  });

  it('leaves out an empty cell between two pipes', () => {
    expect(kinds('|| x |').map((k) => k[0])).toEqual(['pipe', 'pipe', 'cell', 'pipe']);
  });
});

describe('tableTracks', () => {
  it('gives every column its widest cell, the rule left out of the count', () => {
    expect(tableTracks(['| bohater | zawód |', '| ------------------------ | --- |', '| Winston Smith | Ministerstwo Prawdy |']))
      .toEqual(['1ch', '16ch', '1ch', '22ch', '1ch']);
  });

  it('keeps a long column at its full width, for the table to scroll', () => {
    const long = 'w'.repeat(60);
    expect(tableTracks(['| name | note |', '| --- | --- |', `| Julia | ${long} |`]))
      .toEqual(['1ch', '8ch', '1ch', '63ch', '1ch']);
  });

  it('counts Polish letters as one column each', () => {
    expect(tableTracks(['| ż | x |', '|---|---|', '| żółw | y |'])).toEqual(['1ch', '7ch', '1ch', '6ch', '1ch']);
  });

  it('reads a table whose rule leaves off the closing pipe, as GitHub allows', () => {
    expect(tableTracks(['| a | b', '| --- | --- ', '| x | y |'])).toEqual(['1ch', '6ch', '1ch', '6ch', '1ch']);
  });

  it('leaves alone what is not a table', () => {
    expect(tableTracks(['| a | b |', 'not a rule'])).toBeNull();
    expect(tableTracks(['| a |'])).toBeNull();
    expect(isTableRow('a | b')).toBe(false);
  });
});
