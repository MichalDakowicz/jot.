import { EditorView } from '@codemirror/view';

/** A line already this far inside the page is not scrolled to. */
const TOLERANCE = 40;
/** A line scrolled to lands this share of the page below the top, with what leads up to it in view. */
const GAP = 0.2;

/**
 * Puts the caret on the line at `pos`, scrolling only when that line is not
 * comfortably in view. Lines off screen have estimated heights (long wrapped
 * lines most of all), so the first scroll lands near; the line is measured
 * once drawn and the page nudged until it sits where it should.
 */
export function seekLine(view: EditorView, scroller: HTMLElement | null, pos: number) {
  const page = (scroller ?? view.scrollDOM).getBoundingClientRect();
  const want = page.top + Math.round(page.height * GAP);
  const at = view.coordsAtPos(pos);
  const inView = !!at && at.top >= page.top + TOLERANCE && at.bottom <= page.bottom - TOLERANCE;
  view.dispatch({
    selection: { anchor: pos },
    effects: inView ? [] : EditorView.scrollIntoView(pos, { y: 'start', yMargin: want - page.top }),
  });
  view.focus();
  if (inView || !scroller) return;

  let tries = 4;
  const settle = () => {
    const now = view.coordsAtPos(pos);
    const off = now ? now.top - want : 0;
    if (Math.abs(off) > 2) scroller.scrollTop += off;
    if (Math.abs(off) > 2 && --tries > 0) requestAnimationFrame(settle);
  };
  requestAnimationFrame(settle);
}
