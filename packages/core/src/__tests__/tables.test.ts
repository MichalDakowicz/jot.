import { describe, expect, it } from 'vitest';

import { alignTable, isTableRow } from '../tables';

describe('alignTable', () => {
  it('pads every column to its widest cell, the rule in dashes to match', () => {
    expect(alignTable([
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
    expect(alignTable(['|a|b|c|', '|:-|:-:|-:|', '|1|'])).toEqual([
      '| a   |  b  |   c |',
      '| :-- | :-: | --: |',
      '| 1   |     |     |',
    ]);
  });

  it('counts Polish letters as one column each', () => {
    const out = alignTable(['| ż | x |', '|---|---|', '| żółw | y |'])!;
    expect(out[0]).toBe('| ż    | x   |');
    expect(out[2]).toBe('| żółw | y   |');
  });

  it('keeps an escaped pipe inside its cell', () => {
    expect(alignTable(['| a \\| b | c |', '|---|---|'])![0]).toBe('| a \\| b | c   |');
  });

  it('leaves alone what is not a table', () => {
    expect(alignTable(['| a | b |', 'not a rule'])).toBeNull();
    expect(alignTable(['| a |'])).toBeNull();
    expect(isTableRow('a | b')).toBe(false);
  });

  it('is already aligned the second time', () => {
    const once = alignTable(['| a | bb |', '|-|-|', '| ccc | d |'])!;
    expect(alignTable(once)).toEqual(once);
  });
});
