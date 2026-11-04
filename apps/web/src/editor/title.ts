import { ChangeSet, EditorSelection, EditorState, type ChangeSpec, type Extension } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from '@codemirror/view';

import { demoteH1, TITLE_MARK } from '@jot/core/titled';

/** A caret never stands inside the title's "# ", where typing would split the mark. */
function pastMark(head: number) {
  return head < TITLE_MARK.length ? TITLE_MARK.length : head;
}

/**
 * The first line is the note's title and its one h1. Whatever an edit does,
 * the line keeps its "# ", and a "# " typed or pasted anywhere below it is
 * set down to "## ".
 */
const keepTitle = EditorState.transactionFilter.of((tr) => {
  if (!tr.docChanged) {
    const main = tr.selection?.main;
    if (!main || !main.empty || main.head >= TITLE_MARK.length) return tr;
    return [tr, { selection: EditorSelection.cursor(pastMark(main.head)), sequential: true }];
  }
  const doc = tr.newDoc;
  const fixes: ChangeSpec[] = [];

  const first = doc.line(1).text;
  if (!first.startsWith(TITLE_MARK)) {
    if (first.startsWith('#')) fixes.push({ from: 1, insert: ' ' });
    else if (first.startsWith(' ')) fixes.push({ from: 0, insert: '#' });
    else fixes.push({ from: 0, insert: TITLE_MARK });
  }

  const seen = new Set<number>();
  tr.changes.iterChangedRanges((_fromA, _toA, fromB, toB) => {
    for (let n = doc.lineAt(fromB).number; n <= doc.lineAt(toB).number; n++) {
      if (n === 1 || seen.has(n)) continue;
      seen.add(n);
      const line = doc.line(n);
      if (demoteH1(line.text)) fixes.push({ from: line.from, insert: '#' });
    }
  });

  if (!fixes.length) return tr;
  // The caret follows the marks put in, rather than staying in front of them.
  const set = ChangeSet.of(fixes, doc.length);
  const main = tr.newSelection.main;
  const selection = main.empty
    ? EditorSelection.cursor(pastMark(set.mapPos(main.head, 1)))
    : EditorSelection.range(set.mapPos(main.anchor, 1), set.mapPos(main.head, 1));
  return [tr, { changes: fixes, selection, sequential: true }];
});

class Untitled extends WidgetType {
  toDOM() {
    const span = document.createElement('span');
    span.className = 'md-untitled';
    span.textContent = 'Untitled';
    return span;
  }
}

/** "Untitled" in the empty title line, the way a field shows its placeholder. */
const untitled = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = this.build(view);
    }
    update(u: ViewUpdate) {
      if (u.docChanged) this.decorations = this.build(u.view);
    }
    build(view: EditorView) {
      const first = view.state.doc.line(1);
      return first.text.trim() === '#'
        ? Decoration.set([Decoration.widget({ widget: new Untitled(), side: 1 }).range(first.to)])
        : Decoration.none;
    }
  },
  { decorations: (v) => v.decorations },
);

export const titleLine: Extension = [keepTitle, untitled];
