import { Annotation, EditorSelection, Prec } from '@codemirror/state';
import { EditorView, keymap, ViewPlugin, type ViewUpdate } from '@codemirror/view';

import { isTableRow } from '@jot/core/tables';

/** How near a row's edge the caret may come before the table slides to show it. */
const EDGE = 16;

/** Marks the selection set again only to redraw the caret after a table scrolled; it moves nothing. */
const redrawn = Annotation.define<boolean>();

/**
 * A table wider than the line scrolls sideways, every row of it together:
 * scrolling one row moves its table's other rows to match, a row drawn anew
 * after an edit picks up where its table was, and a caret moved out of sight
 * along a row brings the table round to it.
 */
export const tableScroll = ViewPlugin.fromClass(class {
  offsets = new Map<string, number>();
  frame = 0;
  redraw = 0;
  follow = false;

  constructor(readonly view: EditorView) {
    view.contentDOM.addEventListener('scroll', this.onScroll, true);
  }

  onScroll = (e: Event) => {
    const row = e.target;
    if (!(row instanceof HTMLElement) || !row.classList.contains('md-grid') || !row.dataset.table) return;
    this.offsets.set(row.dataset.table, row.scrollLeft);
    this.align(row.dataset.table, row.scrollLeft);
    // The drawn caret and selection do not see a row scroll; setting the same selection redraws them.
    cancelAnimationFrame(this.redraw);
    this.redraw = requestAnimationFrame(() => this.view.dispatch({ selection: this.view.state.selection, annotations: redrawn.of(true) }));
  };

  align(table: string, left: number) {
    for (const row of this.view.contentDOM.querySelectorAll<HTMLElement>(`.md-grid[data-table="${table}"]`)) {
      if (row.scrollLeft !== left) row.scrollLeft = left;
    }
  }

  /** Where the caret's table should sit so the caret is in view along its row, if it is in one. */
  caretTable(): { table: string; left: number } | null {
    const head = this.view.state.selection.main.head;
    const line = this.view.state.doc.lineAt(head);
    // At the very start of a line the DOM position is the line's parent, so look one character in.
    const { node } = this.view.domAtPos(Math.min(Math.max(head, line.from + 1), line.to));
    const row = (node instanceof HTMLElement ? node : node.parentElement)?.closest<HTMLElement>('.md-grid');
    // Measured on the side that stays on this row: before the caret at the row's end, after it elsewhere.
    const atEnd = head === line.to;
    const at = this.view.coordsAtPos(head, atEnd ? -1 : 1) ?? this.view.coordsAtPos(head, atEnd ? 1 : -1);
    if (!row?.dataset.table || !at) return null;
    const box = row.getBoundingClientRect();
    const shift = at.left < box.left + EDGE ? at.left - box.left - EDGE : at.right > box.right - EDGE ? at.right - box.right + EDGE : 0;
    return shift ? { table: row.dataset.table, left: Math.max(0, row.scrollLeft + shift) } : null;
  }

  update(u: ViewUpdate) {
    if (!(u.docChanged || u.viewportChanged || u.selectionSet)) return;
    const moved = u.selectionSet && !u.transactions.some((tr) => tr.annotation(redrawn));
    this.follow ||= u.docChanged || moved;
    // After the editor has drawn: rows drawn anew pick up their table's place, then the caret is brought into view.
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => {
      for (const [table, left] of this.offsets) this.align(table, left);
      const caret = this.follow ? this.caretTable() : null;
      this.follow = false;
      if (caret) {
        this.offsets.set(caret.table, caret.left);
        this.align(caret.table, caret.left);
      }
    });
  }

  destroy() {
    cancelAnimationFrame(this.frame);
    cancelAnimationFrame(this.redraw);
    this.view.contentDOM.removeEventListener('scroll', this.onScroll, true);
  }
});

/** Home and End on a table row go to the row's real start and end, not the edge of what is scrolled into view. */
function toRowEdge(end: boolean, extend: boolean) {
  return (view: EditorView): boolean => {
    const { state } = view;
    const range = state.selection.main;
    const line = state.doc.lineAt(range.head);
    if (!isTableRow(line.text)) return false;
    const to = end ? line.to : line.from;
    view.dispatch({ selection: extend ? EditorSelection.range(range.anchor, to) : EditorSelection.cursor(to) });
    return true;
  };
}

export const tableKeys = Prec.high(keymap.of([
  { key: 'Home', run: toRowEdge(false, false), shift: toRowEdge(false, true) },
  { key: 'End', run: toRowEdge(true, false), shift: toRowEdge(true, true) },
]));
