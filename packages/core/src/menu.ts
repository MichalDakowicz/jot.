/**
 * Keyboard walking for the two menus that open over a block: the slash list
 * and the @ picker.
 */

/** The highlighted row after an arrow: round the list, bottom to top and back. */
export function stepPick(at: number, dir: -1 | 1, count: number): number {
  if (count <= 0) return 0;
  return (((at + dir) % count) + count) % count;
}

/**
 * The first row shown when only `size` rows fit. It moves only as far as it
 * must to keep the highlight in view, so walking down the list scrolls it a
 * row at a time instead of jumping a page.
 */
export function shownFrom(start: number, active: number, count: number, size: number): number {
  let from = start;
  if (active < from) from = active;
  if (active >= from + size) from = active - size + 1;
  return Math.max(0, Math.min(from, count - size));
}
