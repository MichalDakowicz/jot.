import { Prec, type Extension, type Range } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view';

import { isTableRow, rowParts, tableTracks } from '@jot/core/tables';

import { tableKeys, tableScroll } from './tableScroll';

const hiddenSpace = Decoration.mark({ class: 'md-grid-gap' });

/**
 * Tables read as even grids, the caret in them or not: every row of a table
 * is laid out on the same column tracks, its pipes and cells placed in them,
 * every column as wide as its widest cell; a table wider than the line scrolls
 * sideways, all its rows together (see tableScroll).
 * It is the source itself that is laid out, so it is edited in place; nothing
 * is written back.
 */
function build(view: EditorView): DecorationSet {
  const doc = view.state.doc;
  const ranges: Range<Decoration>[] = [];
  let n = 1;
  let table = 0;
  while (n <= doc.lines) {
    if (!isTableRow(doc.line(n).text)) {
      n++;
      continue;
    }
    const start = n;
    while (n <= doc.lines && isTableRow(doc.line(n).text)) n++;
    const lines = Array.from({ length: n - start }, (_, k) => doc.line(start + k).text);
    const tracks = tableTracks(lines);
    if (!tracks) continue;
    const id = String(table++);
    const style = `grid-template-columns: ${tracks.join(' ')}`;
    lines.forEach((text, k) => {
      const line = doc.line(start + k);
      const kind = k === 1 ? ' md-grid-rule' : k === 0 ? ' md-grid-head' : '';
      const last = k === lines.length - 1 ? ' md-grid-last' : '';
      ranges.push(Decoration.line({ class: 'md-grid' + kind + last, attributes: { style, 'data-table': id } }).range(line.from));
      for (const p of rowParts(text)) {
        ranges.push(Decoration.mark({ class: p.kind === 'pipe' ? 'md-grid-pipe' : 'md-grid-cell', attributes: { style: `grid-column: ${p.column}` } })
          .range(line.from + p.from, line.from + p.to));
        // An editor keeps every space, so the ones around a cell's text are folded away; the column pads it.
        const raw = text.slice(p.from, p.to);
        const inner = raw.trim();
        const lead = inner ? raw.indexOf(inner) : raw.length;
        if (lead) ranges.push(hiddenSpace.range(line.from + p.from, line.from + p.from + lead));
        const tail = inner ? raw.length - lead - inner.length : 0;
        if (tail) ranges.push(hiddenSpace.range(line.from + p.to - tail, line.from + p.to));
      }
    });
  }
  return Decoration.set(ranges, true);
}

// Lowest precedence puts these marks outermost, so pipes and cells are the grid's own children.
export const alignedTables: Extension = [tableScroll, tableKeys, Prec.lowest(ViewPlugin.fromClass(
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
))];
