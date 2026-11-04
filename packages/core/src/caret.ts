/**
 * Caret arithmetic for the web editor: character offsets into a block, in and
 * out of the DOM the spans are drawn as.
 *
 * Only ever imported from LiveField.web.tsx, so nothing here reaches a native
 * bundle. Offsets count the text as stored, markers included, which is why
 * every character has to live inside a span.
 */

/** How many characters of `root` come before (node, nodeOffset). */
export function offsetOf(root: Node, node: Node, nodeOffset: number): number {
  const range = document.createRange();
  range.selectNodeContents(root);
  try {
    range.setEnd(node, nodeOffset);
  } catch {
    return 0;
  }
  return range.toString().length;
}

/** The current selection as offsets, or null when it is somewhere else. */
export function readRange(root: Node): { start: number; end: number } | null {
  const sel = typeof window === 'undefined' ? null : window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.startContainer)) return null;
  return {
    start: offsetOf(root, range.startContainer, range.startOffset),
    end: offsetOf(root, range.endContainer, range.endOffset),
  };
}

/** A place the caret can sit, as drawn: its offset, its x, and its line's box. */
export type CaretEdge = { at: number; x: number; top: number; bottom: number };

/**
 * Of the places a caret can sit, the one on the block's first line (`dir` 1,
 * arriving from above) or last line (-1, from below) nearest `x`. This is what
 * keeps the column when the caret crosses into another block.
 *
 * Going down, the far end of a wrapped first line is left out: that offset is
 * also the head of the second line, and a browser draws the caret there.
 */
export function nearestOnLine(edges: CaretEdge[], x: number, dir: -1 | 1): number | null {
  if (!edges.length) return null;
  const line =
    dir > 0
      ? edges.reduce((m, e) => Math.min(m, e.top), Infinity)
      : edges.reduce((m, e) => Math.max(m, e.bottom), -Infinity);
  const on = (e: CaretEdge) =>
    Math.abs((dir > 0 ? e.top : e.bottom) - line) < (e.bottom - e.top) / 2;

  const wrapsAt = new Set(edges.filter((e) => !on(e)).map((e) => e.at));
  const pick = edges.filter((e) => on(e) && !(dir > 0 && wrapsAt.has(e.at)));
  if (!pick.length) return null;

  let best = pick[0];
  for (const e of pick) if (Math.abs(e.x - x) < Math.abs(best.x - x)) best = e;
  return best.at;
}

/**
 * Where a caret arriving from another block lands in `root`: the offset on its
 * near line closest under `x`. Measured a character at a time, since the block
 * may be scrolled out of view, where asking for the caret at a point finds
 * nothing.
 */
export function offsetNearX(root: Node, x: number, dir: -1 | 1): number | null {
  const doc = root.ownerDocument ?? document;
  const walker = doc.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
  const range = doc.createRange();
  const edges: CaretEdge[] = [];
  let seen = 0;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const len = node.textContent?.length ?? 0;
    for (let k = 0; k < len; k += 1) {
      range.setStart(node, k);
      range.setEnd(node, k + 1);
      const r = range.getBoundingClientRect();
      if (!r.height) continue;
      edges.push({ at: seen + k, x: r.left, top: r.top, bottom: r.bottom });
      edges.push({ at: seen + k + 1, x: r.right, top: r.top, bottom: r.bottom });
    }
    seen += len;
  }
  return nearestOnLine(edges, x, dir);
}

/**
 * Put the caret (or a selection) `start`..`end` characters into `root`, by
 * walking its text nodes until the count is reached.
 */
export function putCaret(root: Node, start: number, end: number): void {
  const doc = root.ownerDocument ?? document;
  const walker = doc.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
  const range = doc.createRange();
  let seen = 0;
  let opened = false;
  let closed = false;
  let node = walker.nextNode();

  while (node) {
    const len = node.textContent?.length ?? 0;
    if (!opened && seen + len >= start) {
      range.setStart(node, Math.max(0, start - seen));
      opened = true;
    }
    if (opened && !closed && seen + len >= end) {
      range.setEnd(node, Math.max(0, end - seen));
      closed = true;
      break;
    }
    seen += len;
    node = walker.nextNode();
  }

  if (!opened) {
    // Past the end, or nothing to walk: sit at the very end of the block.
    range.selectNodeContents(root);
    range.collapse(false);
  } else if (!closed) {
    range.setEnd(range.startContainer, range.startOffset);
  }

  const sel = (doc.defaultView ?? window).getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}
