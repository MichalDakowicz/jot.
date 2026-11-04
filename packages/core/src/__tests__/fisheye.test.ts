import { describe, expect, it } from 'vitest';

import { fisheye } from '../fisheye';

describe('fisheye', () => {
  it('leaves every row at base height with nothing hovered', () => {
    expect(fisheye(5, 3, 18, 4, null)).toEqual({ heights: [3, 3, 3, 3, 3], at: 0 });
  });

  it('swells rows nearest the pointer the most', () => {
    const { heights } = fisheye(20, 3, 18, 5, 10.5);
    expect(heights[10]).toBeCloseTo(18);
    expect(heights[9]).toBeLessThan(heights[10]);
    expect(heights[8]).toBeLessThan(heights[9]);
    expect(heights[0]).toBe(3);
    expect(heights[19]).toBe(3);
  });

  it('reports where the focus lands after growth', () => {
    const { heights, at } = fisheye(10, 2, 10, 3, 4.5);
    const before = heights.slice(0, 4).reduce((a, b) => a + b, 0);
    expect(at).toBeCloseTo(before + heights[4] / 2);
  });

  it('clamps a pointer past either end', () => {
    expect(fisheye(4, 2, 8, 2, -3).at).toBe(0);
    expect(fisheye(4, 2, 8, 2, 99).heights[3]).toBeGreaterThan(2);
  });
});
