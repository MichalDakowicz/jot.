import { describe, expect, it } from 'vitest';

import { shownFrom, stepPick } from '../menu';
import { SLASH_ITEMS } from '../typing';

describe('stepPick', () => {
  it('walks the whole slash list, not just the rows that fit', () => {
    let at = 0;
    for (let k = 0; k < 7; k += 1) at = stepPick(at, 1, SLASH_ITEMS.length);

    expect(at).toBe(7);
    expect(SLASH_ITEMS.length).toBeGreaterThan(5);
  });

  it('goes round from the bottom to the top and back', () => {
    expect(stepPick(11, 1, 12)).toBe(0);
    expect(stepPick(0, -1, 12)).toBe(11);
  });

  it('stays put with nothing to pick', () => {
    expect(stepPick(3, 1, 0)).toBe(0);
  });
});

describe('shownFrom', () => {
  it('leaves the window alone while the highlight is in it', () => {
    expect(shownFrom(0, 4, 12, 5)).toBe(0);
    expect(shownFrom(3, 3, 12, 5)).toBe(3);
  });

  it('scrolls a row at a time walking down past the last row shown', () => {
    expect(shownFrom(0, 5, 12, 5)).toBe(1);
    expect(shownFrom(1, 6, 12, 5)).toBe(2);
  });

  it('scrolls back up as far as the highlight', () => {
    expect(shownFrom(7, 6, 12, 5)).toBe(6);
  });

  it('shows the last page when the highlight goes round to the bottom', () => {
    expect(shownFrom(0, 11, 12, 5)).toBe(7);
  });

  it('starts at the top for a list shorter than the window', () => {
    expect(shownFrom(4, 2, 3, 5)).toBe(0);
  });
});
