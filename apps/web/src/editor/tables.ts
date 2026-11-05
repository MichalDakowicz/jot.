import { type Extension, type Range } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from '@codemirror/view';

import { isTableRow, layoutRow, tableColumns } from '@jot/core/tables';

/** Padding shown in a table row: spaces, and the pipes and dashes a row left out, drawn faint. */
class Pad extends WidgetType {
  constructor(readonly text: string) {
    super();
  }
  eq(other: Pad) {
    return other.text === this.text;
  }
  toDOM() {
    const span = document.createElement('span');
    if (/[|\-:]/.test(this.text)) span.className = 'md-syntax';
    span.textContent = this.text;
    return span;
  }
}

/**
 * Tables read as even grids, with the caret in them or not: each row is
 * padded to its columns and the rule under the header drawn in dashes to the
 * same width. Only the space around the cells is shown differently, so the
 * cells are edited in place and the grid holds. Nothing is written back.
 */
function build(view: EditorView): DecorationSet {
  const doc = view.state.doc;
  const ranges: Range<Decoration>[] = [];
  let n = 1;
  while (n <= doc.lines) {
    if (!isTableRow(doc.line(n).text)) {
      n++;
      continue;
    }
    const start = n;
    while (n <= doc.lines && isTableRow(doc.line(n).text)) n++;
    const lines = Array.from({ length: n - start }, (_, k) => doc.line(start + k).text);
    const columns = tableColumns(lines);
    if (!columns) continue;
    lines.forEach((text, k) => {
      const from = doc.line(start + k).from;
      for (const e of layoutRow(text, columns.widths, columns.align, k === 1)) {
        const widget = new Pad(e.text);
        ranges.push(e.from === e.to
          ? Decoration.widget({ widget, side: 1 }).range(from + e.from)
          : Decoration.replace({ widget }).range(from + e.from, from + e.to));
      }
    });
  }
  return Decoration.set(ranges, true);
}

export const alignedTables: Extension = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = build(view);
    }
    update(u: ViewUpdate) {
      if (u.docChanged) this.decorations = build(u.view);
    }
  },
  { decorations: (v) => v.decorations },
);
