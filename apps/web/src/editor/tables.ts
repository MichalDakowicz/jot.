import { type Extension, type Range } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from '@codemirror/view';

import { alignTable, isTableRow } from '@jot/core/tables';

/** One table row as laid out: cells padded, pipes and the header rule drawn faint. */
class AlignedRow extends WidgetType {
  constructor(readonly text: string, readonly rule: boolean) {
    super();
  }
  eq(other: AlignedRow) {
    return other.text === this.text && other.rule === this.rule;
  }
  toDOM() {
    const span = document.createElement('span');
    span.className = 'md-table-row';
    if (this.rule) {
      span.className += ' md-syntax';
      span.textContent = this.text;
      return span;
    }
    for (const part of this.text.split(/(\|)/)) {
      if (part === '|') {
        const pipe = document.createElement('span');
        pipe.className = 'md-syntax';
        pipe.textContent = '|';
        span.append(pipe);
      } else {
        span.append(part);
      }
    }
    return span;
  }
  ignoreEvent() {
    return false;
  }
}

/**
 * Tables read as even grids. Away from the caret each row is shown padded to
 * its columns, the rule under the header in dashes to the same width; with
 * the caret inside, the table is its source again. Nothing is written back.
 */
function build(view: EditorView): DecorationSet {
  const { state } = view;
  const doc = state.doc;
  const caret = doc.lineAt(state.selection.main.head).number;
  const ranges: Range<Decoration>[] = [];
  let n = 1;
  while (n <= doc.lines) {
    if (!isTableRow(doc.line(n).text)) {
      n++;
      continue;
    }
    const start = n;
    while (n <= doc.lines && isTableRow(doc.line(n).text)) n++;
    const end = n - 1;
    if (caret >= start && caret <= end) continue;
    const lines = Array.from({ length: end - start + 1 }, (_, k) => doc.line(start + k).text);
    const aligned = alignTable(lines);
    if (!aligned) continue;
    aligned.forEach((text, k) => {
      const line = doc.line(start + k);
      if (text !== line.text) {
        ranges.push(Decoration.replace({ widget: new AlignedRow(text, k === 1) }).range(line.from, line.to));
      }
    });
  }
  return Decoration.set(ranges);
}

export const alignedTables: Extension = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = build(view);
    }
    update(u: ViewUpdate) {
      if (u.docChanged || u.selectionSet) this.decorations = build(u.view);
    }
  },
  { decorations: (v) => v.decorations },
);
